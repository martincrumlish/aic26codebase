// convex/schema.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("base tables exist with required fields and indexes", async () => {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "op@x.com",
      role: "operator",
      status: "active",
      createdVia: "seed",
      createdAt: Date.now(),
    });
    const tokenId = await ctx.db.insert("provisioningTokens", {
      token: "tok_abc",
      issuerId: userId,
      targetRole: "creator",
      maxUses: 1,
      usedCount: 0,
      expiresAt: Date.now() + 1000,
      revoked: false,
      purpose: "signup",
      createdAt: Date.now(),
    });
    await ctx.db.insert("webhooks", {
      scope: "provision",
      signingSecretRef: "PROVISION_WEBHOOK_SECRET",
      active: true,
    });
    await ctx.db.insert("provisioningEvents", {
      externalId: "ext_1",
      source: "billing",
      type: "grant",
      targetEmail: "creator@x.com",
      role: "creator",
      status: "processed",
      userId,
      receivedAt: Date.now(),
    });
    return { userId, tokenId };
  });

  // by_email index resolves.
  const byEmail = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "op@x.com"))
      .unique(),
  );
  expect(byEmail?._id).toBe(ids.userId);

  // by_token index resolves.
  const byToken = await t.run((ctx) =>
    ctx.db
      .query("provisioningTokens")
      .withIndex("by_token", (q) => q.eq("token", "tok_abc"))
      .unique(),
  );
  expect(byToken?._id).toBe(ids.tokenId);

  // by_externalId index resolves (idempotency key).
  const byExt = await t.run((ctx) =>
    ctx.db
      .query("provisioningEvents")
      .withIndex("by_externalId", (q) => q.eq("externalId", "ext_1"))
      .unique(),
  );
  expect(byExt?.userId).toBe(ids.userId);
});
