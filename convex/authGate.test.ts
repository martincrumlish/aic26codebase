// convex/authGate.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import createOrUpdateUser from "./authGate";

const modules = import.meta.glob("./**/*.ts");

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

describe("authGate.createOrUpdateUser", () => {
  test("rejects an un-provisioned email (no users row created)", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await expect(
        createOrUpdateUser(ctx as any, args({ profile: { email: "ghost@x.com" } })), // eslint-disable-line @typescript-eslint/no-explicit-any
      ).rejects.toThrow(/not enabled/i);
      const row = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "ghost@x.com"))
        .unique();
      expect(row).toBeNull(); // security guarantee: no account
    });
  });

  test("links a pre-seeded email and preserves its role/status", async () => {
    const t = convexTest(schema, modules);
    const seededId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "seeded@x.com",
        role: "creator",
        status: "active",
        createdVia: "webhook",
        createdAt: Date.now(),
      }),
    );
    const returned = await t.run((ctx) =>
      createOrUpdateUser(ctx as any, args({ profile: { email: "seeded@x.com" } })), // eslint-disable-line @typescript-eslint/no-explicit-any
    );
    expect(returned).toBe(seededId);
    const row = await t.run((ctx) => ctx.db.get(seededId));
    expect(row?.role).toBe("creator");
  });

  test("rejects a revoked pre-seeded email", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        email: "revoked@x.com",
        role: "creator",
        status: "revoked",
        createdVia: "webhook",
        createdAt: Date.now(),
      });
      await expect(
        createOrUpdateUser(ctx as any, args({ profile: { email: "revoked@x.com" } })), // eslint-disable-line @typescript-eslint/no-explicit-any
      ).rejects.toThrow(/revoked/i);
    });
  });

  test("consumes a valid signup token (token-on-profile path) → creator", async () => {
    const t = convexTest(schema, modules);
    const issuerId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "op@x.com", role: "operator", status: "active",
        createdVia: "seed", createdAt: Date.now(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("provisioningTokens", {
        token: "signup_tok_1",
        issuerId,
        targetRole: "creator",
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
        profile: { email: "newcreator@x.com", token: "signup_tok_1" },
      })),
    );
    const row = await t.run((ctx) => ctx.db.get(newId));
    expect(row?.role).toBe("creator");
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
        email: "gone@x.com", role: "creator", status: "active",
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
        email: "back@x.com", role: "creator", status: "active",
        createdVia: "token", createdAt: Date.now(),
      }),
    );
    const returned = await t.run((ctx) =>
      createOrUpdateUser(ctx as any, args({ existingUserId: id })), // eslint-disable-line @typescript-eslint/no-explicit-any
    );
    expect(returned).toBe(id);
  });
});
