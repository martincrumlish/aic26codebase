// convex/operator.test.ts
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

async function seed(t: ReturnType<typeof convexTest>, over: Record<string, unknown>) {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      email: `${Math.random()}@x.com`, status: "active",
      createdVia: "seed", createdAt: Date.now(), ...over,
    } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
  );
}

beforeEach(() => vi.stubEnv("PROVISION_WEBHOOK_SECRET", "secret"));
afterEach(() => vi.unstubAllEnvs());

describe("operator console functions (operator-gated)", () => {
  test("generateCreatorToken requires operator and returns a usable signup token", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });
    const creatorId = await seed(t, { role: "creator" });

    await expect(
      t.withIdentity({ subject: creatorId }).mutation(api.operator.generateCreatorToken, {}),
    ).rejects.toThrow(/Operator role required/);

    const { token } = await t
      .withIdentity({ subject: operatorId })
      .mutation(api.operator.generateCreatorToken, {});
    const row = await t.run((ctx) =>
      ctx.db.query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", token)).unique(),
    );
    expect(row?.purpose).toBe("signup");
    expect(row?.targetRole).toBe("creator");
  });

  test("listCreators returns only creators; revokeCreator flips status", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });
    const creatorId = await seed(t, { role: "creator" });
    await seed(t, { role: "member" });

    const list = await t.withIdentity({ subject: operatorId }).query(api.operator.listCreators, {});
    expect(list.map((c: any) => c._id)).toContain(creatorId); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(list.every((c: any) => c.role === "creator")).toBe(true); // eslint-disable-line @typescript-eslint/no-explicit-any

    await t.withIdentity({ subject: operatorId }).mutation(api.operator.revokeCreator, { creatorId });
    const after = await t.run((ctx) => ctx.db.get(creatorId));
    expect(after?.status).toBe("revoked");
  });

  test("getWebhookInfo reports the endpoint + secret presence; platformStats counts roles", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });
    await seed(t, { role: "creator" });
    await seed(t, { role: "member" });

    const info = await t.withIdentity({ subject: operatorId }).query(api.operator.getWebhookInfo, {});
    expect(info.endpointPath).toBe("/provision");
    expect(info.secretSet).toBe(true);

    const stats = await t.withIdentity({ subject: operatorId }).query(api.operator.platformStats, {});
    expect(stats.creators).toBeGreaterThanOrEqual(1);
    expect(stats.members).toBeGreaterThanOrEqual(1);
  });
});

describe("createUserAccount (operator-only)", () => {
  test("operator creates a creator account with a linked password authAccount", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });

    const { userId } = await t
      .withIdentity({ subject: operatorId })
      .action(api.operator.createUserAccount, {
        email: "New.Creator@Example.com",
        name: "New Creator",
        password: "supersecret",
      });

    // users row: normalised email, role creator, status active, createdVia seed.
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.email).toBe("new.creator@example.com");
    expect(user?.role).toBe("creator");
    expect(user?.status).toBe("active");
    expect(user?.name).toBe("New Creator");

    // authAccounts row for provider "password" linked to this user.
    const account = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "password"),
        )
        .unique(),
    );
    expect(account).not.toBeNull();
    expect(account?.providerAccountId).toBe("new.creator@example.com");
  });

  test("rejects a duplicate email", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });
    await seed(t, { email: "dupe@example.com", role: "creator" });

    await expect(
      t.withIdentity({ subject: operatorId }).action(api.operator.createUserAccount, {
        email: "dupe@example.com",
        password: "supersecret",
      }),
    ).rejects.toThrow(/already exists/i);
  });

  test("rejects a password shorter than 8 characters", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });

    await expect(
      t.withIdentity({ subject: operatorId }).action(api.operator.createUserAccount, {
        email: "shortpw@example.com",
        password: "short",
      }),
    ).rejects.toThrow(/at least 8 characters/i);

    // No users row should have been seeded for the rejected email.
    const seeded = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "shortpw@example.com"))
        .unique(),
    );
    expect(seeded).toBeNull();
  });

  test("rejects non-operator callers", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seed(t, { role: "creator" });

    await expect(
      t.withIdentity({ subject: creatorId }).action(api.operator.createUserAccount, {
        email: "blocked@example.com",
        password: "supersecret",
      }),
    ).rejects.toThrow(/Operator role required/);
  });
});

describe("deleteUserAccount (operator-only)", () => {
  test("removes the user and all their auth records", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });
    const creatorId = await seed(t, { role: "creator" });

    // Give the creator an authAccounts + session + refresh-token row.
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("authAccounts", {
        userId: creatorId,
        provider: "password",
        providerAccountId: "creator@x.com",
      });
      const sessionId = await ctx.db.insert("authSessions", {
        userId: creatorId,
        expirationTime: now + 1000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: now + 1000,
      });
    });

    await t
      .withIdentity({ subject: operatorId })
      .mutation(api.operator.deleteUserAccount, { userId: creatorId });

    // User gone.
    expect(await t.run((ctx) => ctx.db.get(creatorId))).toBeNull();
    // authAccounts gone.
    const accounts = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", creatorId))
        .collect(),
    );
    expect(accounts.length).toBe(0);
    // authSessions gone.
    const sessions = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", creatorId))
        .collect(),
    );
    expect(sessions.length).toBe(0);
  });

  test("refuses to delete your own account", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });

    await expect(
      t
        .withIdentity({ subject: operatorId })
        .mutation(api.operator.deleteUserAccount, { userId: operatorId }),
    ).rejects.toThrow(/cannot delete your own account/i);
  });

  test("refuses to delete another operator", async () => {
    const t = convexTest(schema, modules);
    const operatorId = await seed(t, { role: "operator" });
    const otherOperatorId = await seed(t, { role: "operator" });

    await expect(
      t
        .withIdentity({ subject: operatorId })
        .mutation(api.operator.deleteUserAccount, { userId: otherOperatorId }),
    ).rejects.toThrow(/Operators cannot be deleted here/);
  });

  test("rejects non-operator callers", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seed(t, { role: "creator" });
    const targetId = await seed(t, { role: "member" });

    await expect(
      t
        .withIdentity({ subject: creatorId })
        .mutation(api.operator.deleteUserAccount, { userId: targetId }),
    ).rejects.toThrow(/Operator role required/);
  });
});
