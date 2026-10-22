// convex/rateLimits.test.ts — limits on how fast anyone can repeat the things
// that cost money or send email: AI messages, key checks, checkouts, and
// emailed codes. (Convex Auth already limits wrong passwords and wrong codes.)
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { registerStripe, stubStripeApi, stubStripeEnv } from "../vitest/stripe";
import { registerRateLimiter } from "../vitest/rateLimiter";
import { stubAuthEnv } from "../vitest/authEnv";
import { DEFAULT_MODEL } from "./lib/aiModels";
import { LIMITS, waitText } from "./lib/rateLimits";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;

function setupT() {
  const t = convexTest(schema, modules);
  registerStripe(t);
  registerRateLimiter(t);
  return t;
}

async function makeUser(t: T, email: string, role: "admin" | "user" = "user") {
  return t.run((ctx) =>
    ctx.db.insert("users", { email, role, status: "active", createdVia: "seed", createdAt: Date.now() }),
  );
}

const as = (t: T, userId: Id<"users">) => t.withIdentity({ subject: `${userId}|s` });

/** The ConvexError message a call failed with (or null if it succeeded). */
async function errorOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    if (err instanceof ConvexError) return err.data as string;
    throw err;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("waitText", () => {
  test("says how long to wait in words", () => {
    expect(waitText(400)).toBe("1 second");
    expect(waitText(12_300)).toBe("13 seconds");
    expect(waitText(60_000)).toBe("1 minute");
    expect(waitText(61_000)).toBe("2 minutes");
  });
});

describe("AI chat", () => {
  async function userWithOwnKey(t: T) {
    const userId = await makeUser(t, "chatty@x.com");
    await t.run((ctx) =>
      ctx.db.insert("userApiKeys", { userId, provider: "openrouter", key: "sk-or-v1-own-1234", last4: "1234", createdAt: Date.now() }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response("data: [DONE]\n\n")));
    return userId;
  }
  const send = (t: T, userId: Id<"users">) =>
    as(t, userId).mutation(api.chat.send, { content: "Hi", model: DEFAULT_MODEL });

  test("a burst of messages is allowed, then it asks you to slow down", async () => {
    const t = setupT();
    const userId = await userWithOwnKey(t);
    for (let i = 0; i < LIMITS.chatMessage.capacity; i++) await send(t, userId);
    expect(await errorOf(send(t, userId))).toMatch(/sending messages too quickly\. Try again in \d+ seconds?\./);
    // Nothing was saved for the refused message.
    const convos = await t.run((ctx) => ctx.db.query("conversations").take(100));
    expect(convos).toHaveLength(LIMITS.chatMessage.capacity);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  test("it frees up again as time passes, and one person's limit doesn't affect another's", async () => {
    const t = setupT();
    const userId = await userWithOwnKey(t);
    for (let i = 0; i < LIMITS.chatMessage.capacity; i++) await send(t, userId);
    expect(await errorOf(send(t, userId))).not.toBeNull();

    const other = await makeUser(t, "other@x.com");
    await t.run((ctx) =>
      ctx.db.insert("userApiKeys", { userId: other, provider: "openrouter", key: "sk-or-v1-other-99", last4: "r-99", createdAt: Date.now() }),
    );
    expect(await errorOf(send(t, other))).toBeNull();

    vi.advanceTimersByTime(LIMITS.chatMessage.period);
    expect(await errorOf(send(t, userId))).toBeNull();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});

describe("checking an OpenRouter key", () => {
  test("after a few tries it stops calling OpenRouter until later", async () => {
    const t = setupT();
    const userId = await makeUser(t, "keys@x.com");
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchSpy);

    for (let i = 0; i < LIMITS.aiKeyCheck.capacity; i++) {
      expect(await errorOf(as(t, userId).action(api.ai.setOpenRouterKey, { key: `sk-or-v1-guess-${i}` }))).toMatch(
        /rejected/,
      );
    }
    expect(await errorOf(as(t, userId).action(api.ai.setOpenRouterKey, { key: "sk-or-v1-guess-x" }))).toMatch(
      /Too many key checks\. Try again in \d+ minutes?\./,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(LIMITS.aiKeyCheck.capacity);
  });
});

describe("checkout", () => {
  beforeEach(() => stubStripeEnv());

  test("a signed-in user can start checkout a few times, then has to wait", async () => {
    const t = setupT();
    const userId = await makeUser(t, "buyer@x.com");
    const calls = stubStripeApi();
    for (let i = 0; i < LIMITS.checkout.capacity; i++) {
      expect(await errorOf(as(t, userId).action(api.billing.checkout, { interval: "monthly" }))).toBeNull();
    }
    const sessionsBefore = calls.filter((c) => c.path === "/v1/checkout/sessions").length;
    expect(await errorOf(as(t, userId).action(api.billing.checkout, { interval: "monthly" }))).toMatch(
      /Too many checkout attempts\. Try again in \d+ minutes?\./,
    );
    expect(calls.filter((c) => c.path === "/v1/checkout/sessions")).toHaveLength(sessionsBefore);
  });

  test("signed-out checkout has an app-wide limit", async () => {
    const t = setupT();
    stubStripeApi();
    for (let i = 0; i < LIMITS.guestCheckout.capacity; i++) {
      await t.action(api.billing.guestCheckout, { interval: "monthly" });
    }
    expect(await errorOf(t.action(api.billing.guestCheckout, { interval: "monthly" }))).toMatch(
      /Checkout is busy right now\. Try again in \d+ seconds?\./,
    );
  });
});

describe("emailed codes", () => {
  function stubResend() {
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string).to[0]);
        return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
      }),
    );
    return sent;
  }

  test("password reset codes to one address stop after a few, without any error that would reveal the account", async () => {
    vi.useRealTimers(); // the sign-in flow's password hashing needs real timers
    await stubAuthEnv();
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
    const t = setupT();
    const adminId = await makeUser(t, "admin@x.com", "admin");
    await as(t, adminId).action(api.admin.createUserAccount, { email: "victim@x.com", password: "original-password" });
    await as(t, adminId).action(api.admin.createUserAccount, { email: "someone@x.com", password: "original-password" });
    const sent = stubResend();

    const requestReset = (email: string) =>
      t.action(api.auth.signIn, { provider: "password", params: { email, flow: "reset" } });

    for (let i = 0; i < LIMITS.emailCode.capacity + 2; i++) {
      await expect(requestReset("victim@x.com")).resolves.toBeTruthy();
    }
    expect(sent.filter((to) => to === "victim@x.com")).toHaveLength(LIMITS.emailCode.capacity);

    // Other addresses are unaffected.
    await requestReset("someone@x.com");
    expect(sent.filter((to) => to === "someone@x.com")).toHaveLength(1);
  });
});
