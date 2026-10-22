// convex/ai.test.ts — BYOK OpenRouter key management.
import { convexTest as baseConvexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { makePro, registerStripe, stubStripeApi, stubStripeEnv } from "../vitest/stripe";
import { registerRateLimiter } from "../vitest/rateLimiter";

const modules = import.meta.glob("./**/*.ts");

function convexTest(s: typeof schema, m: typeof modules) {
  const t = baseConvexTest(s, m);
  registerStripe(t);
  registerRateLimiter(t);
  return t;
}

function makeUser(t: TestConvex<typeof schema>) {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      email: "c@x.com", role: "user", status: "active",
      createdVia: "token", createdAt: Date.now(),
    }),
  );
}

/** Pro via a real (faked) Stripe webhook; then fetch goes back to OpenRouter stubs. */
async function upgrade(t: TestConvex<typeof schema>, userId: Parameters<typeof makePro>[1]) {
  stubStripeEnv();
  stubStripeApi();
  await makePro(t, userId);
  vi.unstubAllGlobals();
}

/** Stub fetch so setOpenRouterKey's live validation hits our fake OpenRouter. */
function stubOpenRouter(ok: boolean) {
  const spy = vi.fn(async () => new Response(ok ? "{}" : "Unauthorized", { status: ok ? 200 : 401 }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ai.setOpenRouterKey", () => {
  test("verifies the key against OpenRouter and stores it with last4", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    const spy = stubOpenRouter(true);

    await t.withIdentity({ subject: id }).action(api.ai.setOpenRouterKey, {
      key: "sk-or-v1-test-abcd",
    });

    // /api/v1/key is the authenticated key-info endpoint. (/api/v1/models is
    // public and returns 200 even without auth, so it cannot validate a key —
    // verified live: models→200 with no auth, key→401 with a bad key.)
    expect(spy).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/key",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer sk-or-v1-test-abcd" }),
      }),
    );
    const rows = await t.run((ctx) => ctx.db.query("userApiKeys").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: id, provider: "openrouter", key: "sk-or-v1-test-abcd", last4: "abcd",
    });
  });

  test("rejects a key OpenRouter refuses and stores nothing", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    stubOpenRouter(false);

    await expect(
      t.withIdentity({ subject: id }).action(api.ai.setOpenRouterKey, { key: "sk-or-bad" }),
    ).rejects.toThrow(/rejected/i);
    const rows = await t.run((ctx) => ctx.db.query("userApiKeys").collect());
    expect(rows).toHaveLength(0);
  });

  test("replaces an existing key instead of adding a second row", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    stubOpenRouter(true);

    const asUser = t.withIdentity({ subject: id });
    await asUser.action(api.ai.setOpenRouterKey, { key: "sk-or-v1-first-1111" });
    await asUser.action(api.ai.setOpenRouterKey, { key: "sk-or-v1-second-2222" });

    const rows = await t.run((ctx) => ctx.db.query("userApiKeys").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("sk-or-v1-second-2222");
    expect(rows[0].last4).toBe("2222");
  });

  test("requires sign-in", async () => {
    const t = convexTest(schema, modules);
    stubOpenRouter(true);
    await expect(t.action(api.ai.setOpenRouterKey, { key: "sk-or-x" })).rejects.toThrow(
      /not signed in/i,
    );
  });
});

describe("ai.getAiStatus", () => {
  test("reports the user's own key by last4 only — never the key itself", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    stubOpenRouter(true);
    const asUser = t.withIdentity({ subject: id });
    await asUser.action(api.ai.setOpenRouterKey, { key: "sk-or-v1-test-abcd" });

    const status = await asUser.query(api.ai.getAiStatus, {});
    expect(status).toEqual({ enabled: true, source: "own", last4: "abcd" });
  });

  test("Pro users fall back to the app-level OPENROUTER_API_KEY env", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    await upgrade(t, id);
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-app-key");

    const status = await t.withIdentity({ subject: id }).query(api.ai.getAiStatus, {});
    expect(status).toEqual({ enabled: true, source: "app" });
  });

  test("Free users don't get the app key (PLANS.free.limits.appAiKey), and are told Pro would", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-app-key");

    const status = await t.withIdentity({ subject: id }).query(api.ai.getAiStatus, {});
    expect(status).toEqual({ enabled: false, appKeyNeedsPro: true });
  });

  test("is disabled when neither a user key nor the env key exists", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    vi.stubEnv("OPENROUTER_API_KEY", "");

    const status = await t.withIdentity({ subject: id }).query(api.ai.getAiStatus, {});
    expect(status).toEqual({ enabled: false });
  });
});

describe("ai.clearOpenRouterKey", () => {
  test("removes the stored key so status falls back", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    stubOpenRouter(true);
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const asUser = t.withIdentity({ subject: id });
    await asUser.action(api.ai.setOpenRouterKey, { key: "sk-or-v1-test-abcd" });

    await asUser.mutation(api.ai.clearOpenRouterKey, {});

    expect(await asUser.query(api.ai.getAiStatus, {})).toEqual({ enabled: false });
    const rows = await t.run((ctx) => ctx.db.query("userApiKeys").collect());
    expect(rows).toHaveLength(0);
  });
});

describe("ai.getOpenRouterKeyForUser (internal)", () => {
  test("resolves user key → env key (Pro only) → null", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);

    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(
      await t.query(internal.ai.getOpenRouterKeyForUser, { userId: id }),
    ).toBeNull();

    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-app-key");
    expect(
      await t.query(internal.ai.getOpenRouterKeyForUser, { userId: id }),
    ).toBeNull(); // Free plan

    await upgrade(t, id);
    expect(
      await t.query(internal.ai.getOpenRouterKeyForUser, { userId: id }),
    ).toBe("sk-or-app-key");

    stubOpenRouter(true);
    await t.withIdentity({ subject: id }).action(api.ai.setOpenRouterKey, {
      key: "sk-or-v1-user-abcd",
    });
    expect(
      await t.query(internal.ai.getOpenRouterKeyForUser, { userId: id }),
    ).toBe("sk-or-v1-user-abcd");
  });
});

describe("admin.deleteUserAccount cascade", () => {
  test("deletes the user's userApiKeys rows", async () => {
    const t = convexTest(schema, modules);
    const opId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "op@x.com", role: "admin", status: "active",
        createdVia: "seed", createdAt: Date.now(),
      }),
    );
    const id = await makeUser(t);
    stubOpenRouter(true);
    await t.withIdentity({ subject: id }).action(api.ai.setOpenRouterKey, {
      key: "sk-or-v1-test-abcd",
    });

    await t.withIdentity({ subject: opId }).mutation(api.admin.deleteUserAccount, {
      userId: id,
    });

    const rows = await t.run((ctx) => ctx.db.query("userApiKeys").collect());
    expect(rows).toHaveLength(0);
  });
});
