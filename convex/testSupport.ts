// convex/testSupport.ts
// E2E-only helpers invoked via `npx convex run` (NOT exposed to the client API
// surface used by the app — these are internalMutation/internalQuery and require
// CLI access).
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const e2eCreatorSignupToken = internalMutation({
  args: { email: v.string() },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    // Need an issuerId — reuse the seeded operator (bootstrap runs first in the test).
    const op = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "operator"))
      .first();
    if (!op) throw new Error("Operator not seeded; run seed:bootstrapOperator first.");
    const token = crypto.randomUUID();
    const now = Date.now();
    await ctx.db.insert("provisioningTokens", {
      token,
      issuerId: op._id,
      targetRole: "creator",
      email: args.email.toLowerCase().trim(),
      maxUses: 1,
      usedCount: 0,
      expiresAt: now + 1000 * 60 * 60,
      revoked: false,
      purpose: "signup",
      createdAt: now,
    });
    return { token };
  },
});

export const e2eFindUserByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.object({ exists: v.boolean() }),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();
    return { exists: !!row };
  },
});
