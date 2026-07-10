// convex/signupLinks.test.ts — standing signup links: no expiry, unlimited
// uses, rotated manually by the operator (revoke + generate a new one).
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import createOrUpdateUser from "./authGate";

const modules = import.meta.glob("./**/*.ts");

function makeOperator(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      email: "op@x.com", role: "operator", status: "active",
      createdVia: "seed", createdAt: Date.now(),
    }),
  );
}

const gateArgs = (email: string, token: string) => ({
  existingUserId: null,
  type: "credentials" as const,
  provider: { id: "password" },
  profile: { email, token },
});

describe("standing signup links", () => {
  test("generateCreatorToken creates a link with no expiry and no use limit", async () => {
    const t = convexTest(schema, modules);
    const opId = await makeOperator(t);
    const { token } = await t
      .withIdentity({ subject: opId })
      .mutation(api.operator.generateCreatorToken, {});
    const row = await t.run((ctx) =>
      ctx.db.query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", token)).unique(),
    );
    expect(row?.expiresAt).toBeUndefined();
    expect(row?.maxUses).toBeUndefined();
  });

  test("the same link signs up multiple users and stays valid", async () => {
    const t = convexTest(schema, modules);
    const opId = await makeOperator(t);
    const { token } = await t
      .withIdentity({ subject: opId })
      .mutation(api.operator.generateCreatorToken, {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = await t.run((ctx) => createOrUpdateUser(ctx as any, gateArgs("one@x.com", token)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = await t.run((ctx) => createOrUpdateUser(ctx as any, gateArgs("two@x.com", token)));
    expect(a).not.toBe(b);

    const status = await t.query(api.provisioning.validateToken, { token });
    expect(status.valid).toBe(true);
  });

  test("listSignupTokens returns active signup links only (no revoked, no activation tokens)", async () => {
    const t = convexTest(schema, modules);
    const opId = await makeOperator(t);
    const asOp = t.withIdentity({ subject: opId });
    const { token: live } = await asOp.mutation(api.operator.generateCreatorToken, {});
    const { token: dead } = await asOp.mutation(api.operator.generateCreatorToken, { email: "locked@x.com" });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", dead)).unique();
      await ctx.db.patch(row!._id, { revoked: true });
      await ctx.db.insert("provisioningTokens", {
        token: "activation_tok", issuerId: opId, targetRole: "creator",
        usedCount: 0, revoked: false, purpose: "activation", createdAt: Date.now(),
      });
    });

    const list = await asOp.query(api.operator.listSignupTokens, {});
    expect(list.map((l) => l.token)).toEqual([live]);
    expect(list[0].usedCount).toBe(0);
  });

  test("revokeSignupToken is operator-gated and invalidates the link", async () => {
    const t = convexTest(schema, modules);
    const opId = await makeOperator(t);
    const creatorId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "c@x.com", role: "creator", status: "active",
        createdVia: "token", createdAt: Date.now(),
      }),
    );
    const asOp = t.withIdentity({ subject: opId });
    const { token } = await asOp.mutation(api.operator.generateCreatorToken, {});
    const row = await t.run((ctx) =>
      ctx.db.query("provisioningTokens").withIndex("by_token", (q) => q.eq("token", token)).unique(),
    );

    await expect(
      t.withIdentity({ subject: creatorId }).mutation(api.operator.revokeSignupToken, { tokenId: row!._id }),
    ).rejects.toThrow(/Operator role required/);

    await asOp.mutation(api.operator.revokeSignupToken, { tokenId: row!._id });
    const status = await t.query(api.provisioning.validateToken, { token });
    expect(status.valid).toBe(false);
    expect(status.reason).toMatch(/revoked/i);
  });

  test("platformStats counts non-expiring links as active", async () => {
    const t = convexTest(schema, modules);
    const opId = await makeOperator(t);
    const asOp = t.withIdentity({ subject: opId });
    await asOp.mutation(api.operator.generateCreatorToken, {});
    const stats = await asOp.query(api.operator.platformStats, {});
    expect(stats.activeTokens).toBe(1);
  });
});
