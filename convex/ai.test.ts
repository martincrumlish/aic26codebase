// convex/ai.test.ts — BYOK OpenRouter key management.
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

function makeUser(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      email: "c@x.com", role: "creator", status: "active",
      createdVia: "token", createdAt: Date.now(),
    }),
  );
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

  test("falls back to the app-level OPENROUTER_API_KEY env", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-app-key");

    const status = await t.withIdentity({ subject: id }).query(api.ai.getAiStatus, {});
    expect(status).toEqual({ enabled: true, source: "app" });
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
  test("resolves user key → env key → null", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);
    stubOpenRouter(true);

    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(
      await t.query(internal.ai.getOpenRouterKeyForUser, { userId: id }),
    ).toBeNull();

    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-app-key");
    expect(
      await t.query(internal.ai.getOpenRouterKeyForUser, { userId: id }),
    ).toBe("sk-or-app-key");

    await t.withIdentity({ subject: id }).action(api.ai.setOpenRouterKey, {
      key: "sk-or-v1-user-abcd",
    });
    expect(
      await t.query(internal.ai.getOpenRouterKeyForUser, { userId: id }),
    ).toBe("sk-or-v1-user-abcd");
  });
});

describe("operator.deleteUserAccount cascade", () => {
  test("deletes the user's userApiKeys rows", async () => {
    const t = convexTest(schema, modules);
    const opId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "op@x.com", role: "operator", status: "active",
        createdVia: "seed", createdAt: Date.now(),
      }),
    );
    const id = await makeUser(t);
    stubOpenRouter(true);
    await t.withIdentity({ subject: id }).action(api.ai.setOpenRouterKey, {
      key: "sk-or-v1-test-abcd",
    });

    await t.withIdentity({ subject: opId }).mutation(api.operator.deleteUserAccount, {
      userId: id,
    });

    const rows = await t.run((ctx) => ctx.db.query("userApiKeys").collect());
    expect(rows).toHaveLength(0);
  });
});
