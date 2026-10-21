// convex/billing.test.ts — Stripe billing: plans, checkout, portal, and the
// "pay first, account second" flow driven through real signed webhooks.
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  registerStripe,
  sendStripeEvent,
  stubStripeApi,
  stubStripeEnv,
  subscriptionObject,
  STRIPE_ENV,
} from "../vitest/stripe";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;

function setupT() {
  const t = convexTest(schema, modules);
  registerStripe(t);
  return t;
}

async function makeUser(t: T, email = "member@x.com", role: "admin" | "user" = "user") {
  return t.run((ctx) =>
    ctx.db.insert("users", { email, role, status: "active", createdVia: "seed", createdAt: Date.now() }),
  );
}

/** Make the user a paying Pro customer, as the webhook would. */
async function makePro(t: T, userId: Id<"users">, customer = "cus_pro", status = "active") {
  await t.run((ctx) => ctx.db.insert("billingAccounts", { userId, stripeCustomerId: customer }));
  await sendStripeEvent(t, "customer.subscription.created", subscriptionObject({ id: `sub_${customer}`, customer, status }));
}

beforeEach(() => stubStripeEnv());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("plans", () => {
  test("everyone starts on Free", async () => {
    const t = setupT();
    const userId = await makeUser(t);
    const status = await t.withIdentity({ subject: userId }).query(api.billing.status, {});
    expect(status).toMatchObject({ plan: "free", billingEnabled: true });
  });

  test("an active subscription on the user's Stripe customer makes them Pro, with renewal details", async () => {
    const t = setupT();
    stubStripeApi();
    const userId = await makeUser(t);
    await makePro(t, userId);

    const status = await t.withIdentity({ subject: userId }).query(api.billing.status, {});
    expect(status.plan).toBe("pro");
    expect(status.interval).toBe("monthly");
    expect(status.renewsAt).toBeGreaterThan(Date.now());
    expect(status.cancelAtPeriodEnd).toBe(false);
  });

  test("a canceled subscription puts them back on Free", async () => {
    const t = setupT();
    stubStripeApi();
    const userId = await makeUser(t);
    await makePro(t, userId, "cus_c", "canceled");
    const status = await t.withIdentity({ subject: userId }).query(api.billing.status, {});
    expect(status.plan).toBe("free");
  });

  test("billing.enabled is public and reflects whether Stripe is configured", async () => {
    const t = setupT();
    expect(await t.query(api.billing.enabled, {})).toBe(true);
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(await t.query(api.billing.enabled, {})).toBe(false);
  });
});

describe("checkout (signed in)", () => {
  test("requires sign-in", async () => {
    const t = setupT();
    stubStripeApi();
    await expect(t.action(api.billing.checkout, { interval: "monthly" })).rejects.toThrow(/not signed in/i);
  });

  test("says so clearly when billing isn't set up", async () => {
    const t = setupT();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const userId = await makeUser(t);
    await expect(
      t.withIdentity({ subject: userId }).action(api.billing.checkout, { interval: "monthly" }),
    ).rejects.toThrow(/billing isn't set up/i);
  });

  test("starts a subscription Checkout for the chosen interval and remembers the Stripe customer", async () => {
    const t = setupT();
    const calls = stubStripeApi();
    const userId = await makeUser(t);

    const { url } = await t.withIdentity({ subject: userId }).action(api.billing.checkout, { interval: "yearly" });
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.test\//);

    const session = calls.find((c) => c.method === "POST" && c.path === "/v1/checkout/sessions")!;
    expect(session.params.get("mode")).toBe("subscription");
    expect(session.params.get("line_items[0][price]")).toBe(STRIPE_ENV.STRIPE_PRICE_PRO_YEARLY);
    expect(session.params.get("subscription_data[metadata][userId]")).toBe(userId);
    // Back to the Billing tab, which thanks them.
    expect(session.params.get("success_url")).toBe("http://localhost:3000/settings/billing?billing=success");

    const accounts = await t.run((ctx) =>
      ctx.db.query("billingAccounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    );
    expect(accounts).toHaveLength(1);
  });

  test("refuses a second subscription for someone already on Pro", async () => {
    const t = setupT();
    stubStripeApi();
    const userId = await makeUser(t);
    await makePro(t, userId);
    await expect(
      t.withIdentity({ subject: userId }).action(api.billing.checkout, { interval: "monthly" }),
    ).rejects.toThrow(/already on pro/i);
  });
});

describe("customer portal", () => {
  test("opens Stripe's portal for a paying customer", async () => {
    const t = setupT();
    const calls = stubStripeApi();
    const userId = await makeUser(t);
    await makePro(t, userId, "cus_portal");

    const { url } = await t.withIdentity({ subject: userId }).action(api.billing.portal, {});
    expect(url).toBe("https://billing.stripe.test/portal");
    const call = calls.find((c) => c.path === "/v1/billing_portal/sessions")!;
    expect(call.params.get("customer")).toBe("cus_portal");
    expect(call.params.get("return_url")).toBe("http://localhost:3000/settings/billing");
  });

  test("explains there's nothing to manage for someone who never paid", async () => {
    const t = setupT();
    stubStripeApi();
    const userId = await makeUser(t);
    await expect(t.withIdentity({ subject: userId }).action(api.billing.portal, {})).rejects.toThrow(
      /don't have a billing account/i,
    );
  });
});

describe("pay first, account second (guest checkout)", () => {
  const guestSession = (id: string, email: string, customer: string) => ({
    id,
    object: "checkout.session",
    mode: "subscription",
    customer,
    subscription: `sub_for_${id}`,
    customer_details: { email },
    metadata: { guest: "1" },
  });

  test("guestCheckout needs no sign-in and sends the buyer back to /welcome with the session id", async () => {
    const t = setupT();
    const calls = stubStripeApi();
    const { url } = await t.action(api.billing.guestCheckout, { interval: "monthly" });
    expect(url).toBeTruthy();
    const session = calls.find((c) => c.path === "/v1/checkout/sessions")!;
    expect(session.params.get("success_url")).toContain("/welcome?session_id={CHECKOUT_SESSION_ID}");
    expect(session.params.get("metadata[guest]")).toBe("1");
  });

  test("a completed guest checkout creates the account, links the subscription, and hands the buyer an activation link", async () => {
    const t = setupT();
    stubStripeApi();

    expect(await t.query(api.billing.welcome, { checkoutSessionId: "cs_guest_1" })).toEqual({ status: "processing" });

    const res = await sendStripeEvent(t, "checkout.session.completed", guestSession("cs_guest_1", "Buyer@X.com", "cus_buyer"));
    expect(res.status).toBe(200);
    await sendStripeEvent(t, "customer.subscription.created", subscriptionObject({ id: "sub_for_cs_guest_1", customer: "cus_buyer" }));

    const user = await t.run((ctx) =>
      ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "buyer@x.com")).unique(),
    );
    expect(user?.role).toBe("user");

    const welcome = await t.query(api.billing.welcome, { checkoutSessionId: "cs_guest_1" });
    expect(welcome.status).toBe("activate");
    const tok = await t.query(api.provisioning.validateToken, { token: welcome.activationToken! });
    expect(tok).toMatchObject({ valid: true, purpose: "activation", email: "buyer@x.com" });

    const status = await t.withIdentity({ subject: user!._id }).query(api.billing.status, {});
    expect(status.plan).toBe("pro");
  });

  test("a retried webhook doesn't create a second account or link", async () => {
    const t = setupT();
    stubStripeApi();
    const session = guestSession("cs_guest_2", "again@x.com", "cus_again");
    await sendStripeEvent(t, "checkout.session.completed", session);
    await sendStripeEvent(t, "checkout.session.completed", session);
    const users = await t.run((ctx) =>
      ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "again@x.com")).collect(),
    );
    expect(users).toHaveLength(1);
    const tokens = await t.run((ctx) => ctx.db.query("provisioningTokens").take(50));
    expect(tokens.filter((tk) => tk.email === "again@x.com")).toHaveLength(1);
  });

  test("paying with an email that already has an account never hands out an activation link for it", async () => {
    const t = setupT();
    stubStripeApi();
    const existingId = await makeUser(t, "existing@x.com");

    await sendStripeEvent(t, "checkout.session.completed", guestSession("cs_guest_3", "existing@x.com", "cus_existing"));
    await sendStripeEvent(t, "customer.subscription.created", subscriptionObject({ id: "sub_for_cs_guest_3", customer: "cus_existing" }));

    expect(await t.query(api.billing.welcome, { checkoutSessionId: "cs_guest_3" })).toEqual({ status: "signin" });
    const status = await t.withIdentity({ subject: existingId }).query(api.billing.status, {});
    expect(status.plan).toBe("pro");
  });

  test("an unsigned or forged webhook is rejected and changes nothing", async () => {
    const t = setupT();
    stubStripeApi();
    const res = await t.fetch("/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ type: "checkout.session.completed", data: { object: guestSession("cs_x", "x@x.com", "cus_x") } }),
    });
    expect(res.status).toBe(400);
    const user = await t.run((ctx) =>
      ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "x@x.com")).unique(),
    );
    expect(user).toBeNull();
  });
});

describe("deleting a user", () => {
  test("cancels their Stripe subscriptions and removes their billing links", async () => {
    vi.useFakeTimers();
    const t = setupT();
    const calls = stubStripeApi();
    const adminId = await makeUser(t, "admin@x.com", "admin");
    const userId = await makeUser(t);
    await makePro(t, userId, "cus_gone");

    await t.withIdentity({ subject: adminId }).mutation(api.admin.deleteUserAccount, { userId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(calls.some((c) => c.method === "DELETE" && c.path === "/v1/subscriptions/sub_cus_gone")).toBe(true);
    const accounts = await t.run((ctx) =>
      ctx.db.query("billingAccounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    );
    expect(accounts).toHaveLength(0);
  });
});
