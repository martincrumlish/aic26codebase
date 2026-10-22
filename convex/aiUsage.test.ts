// convex/aiUsage.test.ts — monthly allowance for AI messages on the app's
// OpenRouter key (so one heavy user can't run up the owner's bill). Your own
// key is never limited: you pay for it.
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { makePro, registerStripe, stubStripeApi, stubStripeEnv } from "../vitest/stripe";
import { registerRateLimiter } from "../vitest/rateLimiter";
import { DEFAULT_MODEL } from "./lib/aiModels";
import { PLANS } from "./lib/plans";
import { currentPeriod } from "./lib/aiUsage";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;
const LIMIT = PLANS.pro.limits.appAiMessagesPerMonth;

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

/** A reply stream that does nothing (the scheduled reply isn't under test). */
function stubOpenRouter() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("data: [DONE]\n\n")));
}

async function proOnAppKey(t: T) {
  const userId = await makeUser(t, "pro@x.com");
  stubStripeApi();
  await makePro(t, userId);
  stubOpenRouter();
  return userId;
}

async function setUsed(t: T, userId: Id<"users">, messages: number) {
  await t.run((ctx) => ctx.db.insert("aiUsage", { userId, period: currentPeriod(Date.now()), messages }));
}

const send = (t: T, userId: Id<"users">) =>
  t.withIdentity({ subject: `${userId}|s` }).mutation(api.chat.send, { content: "Hi", model: DEFAULT_MODEL });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  stubStripeEnv();
  vi.stubEnv("OPENROUTER_API_KEY", "sk-or-app");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI allowance on the app's key", () => {
  test("Pro has a monthly allowance, and each message on the app's key counts", async () => {
    expect(LIMIT).toBeGreaterThan(0);
    const t = setupT();
    const userId = await proOnAppKey(t);
    await send(t, userId);
    await send(t, userId);
    const usage = await t.withIdentity({ subject: `${userId}|s` }).query(api.ai.usage, {});
    expect(usage).toEqual({
      source: "app", used: 2, limit: LIMIT, resetsAt: Date.parse("2026-11-01T00:00:00Z"),
    });
  });

  test("at the limit, sending is refused with what to do next", async () => {
    const t = setupT();
    const userId = await proOnAppKey(t);
    await setUsed(t, userId, LIMIT - 1);
    await send(t, userId); // the last one included
    await expect(send(t, userId)).rejects.toThrow(/used all .* AI messages .* this month.*own OpenRouter key/i);
  });

  test("a new month starts again", async () => {
    const t = setupT();
    const userId = await proOnAppKey(t);
    await setUsed(t, userId, LIMIT);
    await expect(send(t, userId)).rejects.toThrow(/used all/i);
    vi.setSystemTime(new Date("2026-11-01T00:00:01Z"));
    await send(t, userId);
    expect((await t.withIdentity({ subject: `${userId}|s` }).query(api.ai.usage, {})).used).toBe(1);
  });

  test("your own key is never limited or counted", async () => {
    const t = setupT();
    const userId = await makeUser(t, "own@x.com");
    await t.run((ctx) =>
      ctx.db.insert("userApiKeys", { userId, provider: "openrouter", key: "sk-or-own", last4: "-own", createdAt: Date.now() }),
    );
    stubOpenRouter();
    await setUsed(t, userId, 10_000);
    await send(t, userId);
    expect(await t.withIdentity({ subject: `${userId}|s` }).query(api.ai.usage, {})).toEqual({
      source: "own", used: 0, limit: null, resetsAt: null,
    });
  });

  test("no AI at all: usage says so", async () => {
    const t = setupT();
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const userId = await makeUser(t, "none@x.com");
    expect(await t.withIdentity({ subject: `${userId}|s` }).query(api.ai.usage, {})).toEqual({
      source: null, used: 0, limit: null, resetsAt: null,
    });
  });

  test("deleting a user deletes their usage records", async () => {
    const t = setupT();
    const adminId = await makeUser(t, "admin@x.com", "admin");
    const userId = await proOnAppKey(t);
    await send(t, userId);
    await t.withIdentity({ subject: `${adminId}|s` }).mutation(api.admin.deleteUserAccount, { userId });
    expect(await t.run((ctx) => ctx.db.query("aiUsage").take(5))).toEqual([]);
  });
});
