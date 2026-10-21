// scripts/stripe-setup-core.test.mjs
import { describe, expect, test } from "vitest";
import { formEncode, setupStripe, WEBHOOK_EVENTS } from "./stripe-setup-core.mjs";

const PLAN = { currency: "usd", monthly: 1200, yearly: 12000 };
const SITE = "https://happy-otter-123.convex.site";

/** A tiny in-memory Stripe. Records every call. */
function fakeStripe() {
  const db = { products: [], prices: [], endpoints: [], portals: [] };
  const calls = [];
  let n = 0;
  const id = (p) => `${p}_${++n}`;
  async function stripeFetch(method, path, params = {}) {
    calls.push({ method, path, params });
    if (method === "GET" && path === "/v1/prices") {
      const keys = params.lookup_keys ?? [];
      return { data: db.prices.filter((p) => keys.includes(p.lookup_key) && p.active) };
    }
    if (method === "POST" && path === "/v1/products") {
      const p = { id: id("prod"), name: params.name };
      db.products.push(p);
      return p;
    }
    if (method === "POST" && path === "/v1/prices") {
      if (params.transfer_lookup_key) {
        db.prices.filter((p) => p.lookup_key === params.lookup_key).forEach((p) => (p.lookup_key = null));
      }
      const p = {
        id: id("price"), product: params.product, unit_amount: Number(params.unit_amount),
        currency: params.currency, lookup_key: params.lookup_key, active: true,
        recurring: { interval: params.recurring.interval },
      };
      db.prices.push(p);
      return p;
    }
    if (method === "GET" && path === "/v1/webhook_endpoints") return { data: db.endpoints };
    if (method === "DELETE" && path.startsWith("/v1/webhook_endpoints/")) {
      db.endpoints = db.endpoints.filter((e) => `/v1/webhook_endpoints/${e.id}` !== path);
      return { deleted: true };
    }
    if (method === "POST" && path === "/v1/webhook_endpoints") {
      const e = { id: id("we"), url: params.url, secret: `whsec_${n}` };
      db.endpoints.push(e);
      return e;
    }
    if (method === "GET" && path === "/v1/billing_portal/configurations") return { data: db.portals };
    if (method === "POST" && path === "/v1/billing_portal/configurations") {
      const c = { id: id("bpc"), is_default: true };
      db.portals.push(c);
      return c;
    }
    throw new Error(`fake Stripe: unhandled ${method} ${path}`);
  }
  return { stripeFetch, calls, db };
}

describe("setupStripe", () => {
  test("first run creates the Pro product, both prices, the webhook, and a portal config", async () => {
    const fake = fakeStripe();
    const out = await setupStripe({ stripeFetch: fake.stripeFetch, convexSiteUrl: SITE, plan: PLAN });

    expect(fake.db.products).toHaveLength(1);
    const monthly = fake.db.prices.find((p) => p.id === out.priceMonthly);
    const yearly = fake.db.prices.find((p) => p.id === out.priceYearly);
    expect(monthly).toMatchObject({ unit_amount: 1200, currency: "usd", recurring: { interval: "month" } });
    expect(yearly).toMatchObject({ unit_amount: 12000, recurring: { interval: "year" } });

    expect(fake.db.endpoints).toHaveLength(1);
    expect(fake.db.endpoints[0].url).toBe(`${SITE}/stripe/webhook`);
    expect(out.webhookSecret).toBe(fake.db.endpoints[0].secret);
    const created = fake.calls.find((c) => c.method === "POST" && c.path === "/v1/webhook_endpoints");
    expect(created.params.enabled_events).toEqual(WEBHOOK_EVENTS);
    expect(WEBHOOK_EVENTS).toContain("checkout.session.completed");
    expect(WEBHOOK_EVENTS).toContain("customer.subscription.updated");

    expect(fake.db.portals).toHaveLength(1);
  });

  test("re-running reuses the prices and portal, and replaces the webhook (Stripe only reveals a secret at creation)", async () => {
    const fake = fakeStripe();
    const first = await setupStripe({ stripeFetch: fake.stripeFetch, convexSiteUrl: SITE, plan: PLAN });
    const second = await setupStripe({ stripeFetch: fake.stripeFetch, convexSiteUrl: SITE, plan: PLAN });

    expect(second.priceMonthly).toBe(first.priceMonthly);
    expect(second.priceYearly).toBe(first.priceYearly);
    expect(fake.db.products).toHaveLength(1);
    expect(fake.db.portals).toHaveLength(1);
    expect(fake.db.endpoints).toHaveLength(1);
    expect(second.webhookSecret).not.toBe(first.webhookSecret);
  });

  test("a changed price in plans.ts creates a new price that takes over the lookup key", async () => {
    const fake = fakeStripe();
    const first = await setupStripe({ stripeFetch: fake.stripeFetch, convexSiteUrl: SITE, plan: PLAN });
    const second = await setupStripe({
      stripeFetch: fake.stripeFetch, convexSiteUrl: SITE, plan: { ...PLAN, monthly: 1500 },
    });
    expect(second.priceMonthly).not.toBe(first.priceMonthly);
    expect(second.priceYearly).toBe(first.priceYearly);
    expect(fake.db.prices.find((p) => p.id === second.priceMonthly)).toMatchObject({
      unit_amount: 1500, lookup_key: "pro_monthly",
    });
    expect(fake.db.products).toHaveLength(1);
  });
});

describe("formEncode", () => {
  test("encodes nested objects and arrays the way Stripe expects", () => {
    expect(formEncode({ a: "1", recurring: { interval: "month" }, list: ["x", "y"] })).toBe(
      "a=1&recurring%5Binterval%5D=month&list%5B0%5D=x&list%5B1%5D=y",
    );
  });
});
