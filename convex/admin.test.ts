// convex/admin.test.ts
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import createOrUpdateUser from "./authGate";

const modules = import.meta.glob("./**/*.ts");

async function seed(
  t: ReturnType<typeof convexTest>,
  role: "admin" | "user",
  over: Record<string, unknown> = {},
) {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      email: `${Math.random()}@x.com`, role, status: "active",
      createdVia: "seed", createdAt: Date.now(), ...over,
    } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
  );
}

const gateArgs = (email: string, token: string) => ({
  existingUserId: null,
  type: "credentials" as const,
  provider: { id: "password" },
  profile: { email, token },
});

beforeEach(() => vi.stubEnv("PROVISION_WEBHOOK_SECRET", "secret"));
afterEach(() => vi.unstubAllEnvs());

describe("admin functions are admin-only", () => {
  test("regular users are rejected", async () => {
    const t = convexTest(schema, modules);
    const userId = await seed(t, "user");
    const asUser = t.withIdentity({ subject: userId });
    await expect(asUser.query(api.admin.listUsers, {})).rejects.toThrow(/Admin role required/);
    await expect(asUser.query(api.admin.platformStats, {})).rejects.toThrow(/Admin role required/);
    await expect(asUser.query(api.admin.listSignupLinks, {})).rejects.toThrow(/Admin role required/);
    await expect(asUser.mutation(api.admin.createSignupLink, {})).rejects.toThrow(/Admin role required/);
    await expect(asUser.query(api.admin.getWebhookInfo, {})).rejects.toThrow(/Admin role required/);
    await expect(
      asUser.mutation(api.admin.setUserRole, { userId, role: "admin" }),
    ).rejects.toThrow(/Admin role required/);
  });
});

describe("listUsers / platformStats", () => {
  test("lists admins and users with their roles; stats count each", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const userId = await seed(t, "user");
    const asAdmin = t.withIdentity({ subject: adminId });

    const list = await asAdmin.query(api.admin.listUsers, {});
    const roles = Object.fromEntries(list.map((u) => [u._id, u.role]));
    expect(roles[adminId]).toBe("admin");
    expect(roles[userId]).toBe("user");

    await asAdmin.mutation(api.admin.createSignupLink, {});
    const stats = await asAdmin.query(api.admin.platformStats, {});
    expect(stats).toEqual({ users: 1, admins: 1, activeLinks: 1 });
  });
});

describe("signup links", () => {
  test("createSignupLink makes a standing link (no expiry, no limit) that grants role user", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const { token } = await t
      .withIdentity({ subject: adminId })
      .mutation(api.admin.createSignupLink, {});
    const row = await t.run((ctx) =>
      ctx.db.query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", token)).unique(),
    );
    expect(row?.purpose).toBe("signup");
    expect(row?.targetRole).toBe("user");
    expect(row?.expiresAt).toBeUndefined();
    expect(row?.maxUses).toBeUndefined();
  });

  test("optional maxUses and ttlDays make a one-off or time-boxed link", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const { token } = await t
      .withIdentity({ subject: adminId })
      .mutation(api.admin.createSignupLink, { maxUses: 1, ttlDays: 3 });
    const row = await t.run((ctx) =>
      ctx.db.query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", token)).unique(),
    );
    expect(row?.maxUses).toBe(1);
    expect(row?.expiresAt).toBeGreaterThan(Date.now() + 1000 * 60 * 60 * 24 * 2);
  });

  test("the same link signs up multiple users, each as role user, and stays valid", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const { token } = await t
      .withIdentity({ subject: adminId })
      .mutation(api.admin.createSignupLink, {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = await t.run((ctx) => createOrUpdateUser(ctx as any, gateArgs("one@x.com", token)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = await t.run((ctx) => createOrUpdateUser(ctx as any, gateArgs("two@x.com", token)));
    expect(a).not.toBe(b);
    expect((await t.run((ctx) => ctx.db.get(a)))?.role).toBe("user");
    expect((await t.run((ctx) => ctx.db.get(b)))?.role).toBe("user");

    const status = await t.query(api.provisioning.validateToken, { token });
    expect(status.valid).toBe(true);
  });

  test("listSignupLinks returns active signup links only (no revoked, no activation tokens)", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const asAdmin = t.withIdentity({ subject: adminId });
    const { token: live } = await asAdmin.mutation(api.admin.createSignupLink, {});
    const { token: dead } = await asAdmin.mutation(api.admin.createSignupLink, { email: "locked@x.com" });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", dead)).unique();
      await ctx.db.patch(row!._id, { revoked: true });
      await ctx.db.insert("provisioningTokens", {
        token: "activation_tok", issuerId: adminId, targetRole: "user",
        usedCount: 0, revoked: false, purpose: "activation", createdAt: Date.now(),
      });
    });

    const list = await asAdmin.query(api.admin.listSignupLinks, {});
    expect(list.map((l) => l.token)).toEqual([live]);
    expect(list[0].usedCount).toBe(0);
  });

  test("revokeSignupLink invalidates the link", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const asAdmin = t.withIdentity({ subject: adminId });
    const { token } = await asAdmin.mutation(api.admin.createSignupLink, {});
    const row = await t.run((ctx) =>
      ctx.db.query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", token)).unique(),
    );

    await asAdmin.mutation(api.admin.revokeSignupLink, { linkId: row!._id });
    const status = await t.query(api.provisioning.validateToken, { token });
    expect(status.valid).toBe(false);
    expect(status.reason).toMatch(/revoked/i);
  });
});

describe("revoke / restore / role changes", () => {
  test("revokeUser disables an account and restoreUser re-enables it", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const userId = await seed(t, "user");
    const asAdmin = t.withIdentity({ subject: adminId });

    await asAdmin.mutation(api.admin.revokeUser, { userId });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.status).toBe("revoked");

    await asAdmin.mutation(api.admin.restoreUser, { userId });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.status).toBe("active");
  });

  test("revokeUser refuses your own account and other admins", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const otherAdminId = await seed(t, "admin");
    const asAdmin = t.withIdentity({ subject: adminId });

    await expect(
      asAdmin.mutation(api.admin.revokeUser, { userId: adminId }),
    ).rejects.toThrow(/your own account/i);
    await expect(
      asAdmin.mutation(api.admin.revokeUser, { userId: otherAdminId }),
    ).rejects.toThrow(/remove admin rights/i);
  });

  test("setUserRole promotes a user to admin and back", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const userId = await seed(t, "user");
    const asAdmin = t.withIdentity({ subject: adminId });

    await asAdmin.mutation(api.admin.setUserRole, { userId, role: "admin" });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.role).toBe("admin");
    // The promoted user can now use admin functions.
    await t.withIdentity({ subject: userId }).query(api.admin.listUsers, {});

    await asAdmin.mutation(api.admin.setUserRole, { userId, role: "user" });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.role).toBe("user");
  });

  test("setUserRole refuses to change your own role", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    await expect(
      t.withIdentity({ subject: adminId }).mutation(api.admin.setUserRole, {
        userId: adminId, role: "user",
      }),
    ).rejects.toThrow(/your own role/i);
  });
});

describe("getWebhookInfo", () => {
  test("reports the endpoint path and whether the secret is set", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const info = await t.withIdentity({ subject: adminId }).query(api.admin.getWebhookInfo, {});
    expect(info.endpointPath).toBe("/provision");
    expect(info.secretSet).toBe(true);
  });
});

describe("createUserAccount (admin-only)", () => {
  test("admin creates a user account with a linked password authAccount", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");

    const { userId } = await t
      .withIdentity({ subject: adminId })
      .action(api.admin.createUserAccount, {
        email: "New.User@Example.com",
        name: "New User",
        password: "supersecret",
      });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.email).toBe("new.user@example.com");
    expect(user?.role).toBe("user");
    expect(user?.status).toBe("active");
    expect(user?.name).toBe("New User");

    const account = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "password"),
        )
        .unique(),
    );
    expect(account?.providerAccountId).toBe("new.user@example.com");
  });

  test("rejects a duplicate email", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    await seed(t, "user", { email: "dupe@example.com" });

    await expect(
      t.withIdentity({ subject: adminId }).action(api.admin.createUserAccount, {
        email: "dupe@example.com",
        password: "supersecret",
      }),
    ).rejects.toThrow(/already exists/i);
  });

  test("rejects a password shorter than 8 characters and seeds nothing", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");

    await expect(
      t.withIdentity({ subject: adminId }).action(api.admin.createUserAccount, {
        email: "shortpw@example.com",
        password: "short",
      }),
    ).rejects.toThrow(/at least 8 characters/i);

    const seeded = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "shortpw@example.com"))
        .unique(),
    );
    expect(seeded).toBeNull();
  });

  test("rejects non-admin callers", async () => {
    const t = convexTest(schema, modules);
    const userId = await seed(t, "user");

    await expect(
      t.withIdentity({ subject: userId }).action(api.admin.createUserAccount, {
        email: "blocked@example.com",
        password: "supersecret",
      }),
    ).rejects.toThrow(/Admin role required/);
  });
});

describe("deleteUserAccount (admin-only)", () => {
  test("removes the user and all their auth records", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const userId = await seed(t, "user");

    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "user@x.com",
      });
      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: now + 1000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: now + 1000,
      });
    });

    await t
      .withIdentity({ subject: adminId })
      .mutation(api.admin.deleteUserAccount, { userId });

    expect(await t.run((ctx) => ctx.db.get(userId))).toBeNull();
    const accounts = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(accounts.length).toBe(0);
    const sessions = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(sessions.length).toBe(0);
  });

  test("refuses to delete your own account", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");

    await expect(
      t.withIdentity({ subject: adminId }).mutation(api.admin.deleteUserAccount, { userId: adminId }),
    ).rejects.toThrow(/your own account/i);
  });

  test("refuses to delete another admin until their admin rights are removed", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seed(t, "admin");
    const otherAdminId = await seed(t, "admin");

    await expect(
      t.withIdentity({ subject: adminId }).mutation(api.admin.deleteUserAccount, { userId: otherAdminId }),
    ).rejects.toThrow(/remove admin rights/i);
  });

  test("rejects non-admin callers", async () => {
    const t = convexTest(schema, modules);
    const userId = await seed(t, "user");
    const targetId = await seed(t, "user");

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.admin.deleteUserAccount, { userId: targetId }),
    ).rejects.toThrow(/Admin role required/);
  });
});
