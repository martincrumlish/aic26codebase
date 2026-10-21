// convex/authGate.test.ts
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import createOrUpdateUser from "./authGate";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => vi.unstubAllEnvs());

// Minimal args matching @convex-dev/auth createOrUpdateUser shape.
function args(over: Partial<Record<string, unknown>> = {}) {
  return {
    existingUserId: null,
    type: "credentials" as const,
    provider: { id: "password" },
    profile: { email: "x@x.com" },
    shouldLink: false,
    ...over,
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** A pre-created users row (as the seed/webhook make) plus an activation token for it. */
async function seedWithActivation(
  t: ReturnType<typeof convexTest>,
  email: string,
  opts: {
    token: string;
    status?: "active" | "revoked";
    usedCount?: number;
    expiresAt?: number;
    revoked?: boolean;
  },
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email, role: "user", status: opts.status ?? "active",
      createdVia: "webhook", createdAt: Date.now(),
    });
    await ctx.db.insert("provisioningTokens", {
      token: opts.token, issuerId: userId, targetRole: "user", email,
      maxUses: 1, usedCount: opts.usedCount ?? 0,
      expiresAt: opts.expiresAt ?? Date.now() + 60_000,
      revoked: opts.revoked ?? false, purpose: "activation", createdAt: Date.now(),
    });
    return userId;
  });
}

describe("authGate.createOrUpdateUser", () => {
  test("open mode (default): a new email gets a fresh user account", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      createOrUpdateUser(ctx as any, args({ profile: { email: "Fresh@x.com" } })), // eslint-disable-line @typescript-eslint/no-explicit-any
    );
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({ email: "fresh@x.com", role: "user", status: "active", createdVia: "signup" });
  });

  test("link-only mode: rejects an un-provisioned email (no users row created)", async () => {
    vi.stubEnv("SIGNUP_MODE", "link");
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await expect(
        createOrUpdateUser(ctx as any, args({ profile: { email: "ghost@x.com" } })), // eslint-disable-line @typescript-eslint/no-explicit-any
      ).rejects.toThrow(/couldn't create an account/i);
      const row = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "ghost@x.com"))
        .unique();
      expect(row).toBeNull(); // security guarantee: no account
    });
  });

  test("links a pre-seeded email with its activation token, and uses the token up", async () => {
    const t = convexTest(schema, modules);
    const seededId = await seedWithActivation(t, "seeded@x.com", { token: "act_ok" });
    const returned = await t.run((ctx) =>
      createOrUpdateUser(ctx as any, args({ profile: { email: "seeded@x.com", token: "act_ok" } })), // eslint-disable-line @typescript-eslint/no-explicit-any
    );
    expect(returned).toBe(seededId);
    const row = await t.run((ctx) => ctx.db.get(seededId));
    expect(row?.role).toBe("user");
    const tok = await t.run((ctx) =>
      ctx.db.query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", "act_ok")).unique(),
    );
    expect(tok?.usedCount).toBe(1);
  });

  test("never links a pre-seeded email without a valid activation token for it", async () => {
    const t = convexTest(schema, modules);
    await seedWithActivation(t, "victim@x.com", { token: "act_victim" });
    await seedWithActivation(t, "other@x.com", { token: "act_other" });
    await seedWithActivation(t, "used@x.com", { token: "act_used", usedCount: 1 });
    await seedWithActivation(t, "expired@x.com", { token: "act_expired", expiresAt: Date.now() - 1 });
    await seedWithActivation(t, "revoked-tok@x.com", { token: "act_revoked", revoked: true });
    await t.run(async (ctx) => {
      const issuer = (await ctx.db.query("users").first())!._id;
      await ctx.db.insert("provisioningTokens", {
        token: "signup_link", issuerId: issuer, targetRole: "user",
        usedCount: 0, revoked: false, purpose: "signup", createdAt: Date.now(),
      });
    });

    const attempts: Array<[string, string | undefined]> = [
      ["victim@x.com", undefined],          // no token at all
      ["victim@x.com", "signup_link"],      // a signup link, not an activation token
      ["victim@x.com", "act_other"],        // someone else's activation token
      ["used@x.com", "act_used"],           // already used
      ["expired@x.com", "act_expired"],     // expired
      ["revoked-tok@x.com", "act_revoked"], // revoked
    ];
    for (const [email, token] of attempts) {
      await t.run(async (ctx) => {
        await expect(
          createOrUpdateUser(ctx as any, args({ profile: { email, token } })), // eslint-disable-line @typescript-eslint/no-explicit-any
        ).rejects.toThrow(/couldn't create an account/i);
      });
    }
  });

  test("rejects a revoked pre-seeded account even with a valid activation token", async () => {
    const t = convexTest(schema, modules);
    await seedWithActivation(t, "revoked@x.com", { token: "act_r", status: "revoked" });
    await t.run(async (ctx) => {
      await expect(
        createOrUpdateUser(ctx as any, args({ profile: { email: "revoked@x.com", token: "act_r" } })), // eslint-disable-line @typescript-eslint/no-explicit-any
      ).rejects.toThrow(/revoked/i);
    });
  });

  test("consumes a valid signup token (token-on-profile path) → user", async () => {
    const t = convexTest(schema, modules);
    const issuerId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "op@x.com", role: "admin", status: "active",
        createdVia: "seed", createdAt: Date.now(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("provisioningTokens", {
        token: "signup_tok_1",
        issuerId,
        targetRole: "user",
        maxUses: 1,
        usedCount: 0,
        expiresAt: Date.now() + 60_000,
        revoked: false,
        purpose: "signup",
        createdAt: Date.now(),
      }),
    );
    const newId = await t.run((ctx) =>
      createOrUpdateUser(ctx as any, args({ // eslint-disable-line @typescript-eslint/no-explicit-any
        profile: { email: "newuser@x.com", token: "signup_tok_1" },
      })),
    );
    const row = await t.run((ctx) => ctx.db.get(newId));
    expect(row?.role).toBe("user");
    expect(row?.createdVia).toBe("token");
    const tok = await t.run((ctx) =>
      ctx.db.query("provisioningTokens")
        .withIndex("by_token", (q) => q.eq("token", "signup_tok_1")).unique(),
    );
    expect(tok?.usedCount).toBe(1); // consumed
  });

  test("rejects when existingUserId points to a missing user doc (no silent pass)", async () => {
    const t = convexTest(schema, modules);
    // Create then delete a user to obtain a dangling id.
    const danglingId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        email: "gone@x.com", role: "user", status: "active",
        createdVia: "token", createdAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });
    await t.run(async (ctx) => {
      await expect(
        createOrUpdateUser(ctx as any, args({ existingUserId: danglingId })), // eslint-disable-line @typescript-eslint/no-explicit-any
      ).rejects.toThrow(/account/i);
    });
  });

  test("returns existing linked user on returning sign-in", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "back@x.com", role: "user", status: "active",
        createdVia: "token", createdAt: Date.now(),
      }),
    );
    const returned = await t.run((ctx) =>
      createOrUpdateUser(ctx as any, args({ existingUserId: id })), // eslint-disable-line @typescript-eslint/no-explicit-any
    );
    expect(returned).toBe(id);
  });
});
