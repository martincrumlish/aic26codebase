// convex/seed.ts
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Creates the first admin (from the ADMIN_EMAIL env var) plus a single-use
// activation link. Idempotent: re-running when the admin exists is a no-op.
export const bootstrapAdmin = internalMutation({
  args: {},
  returns: v.object({
    userId: v.id("users"),
    created: v.boolean(),
    activationToken: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    if (!email) throw new Error("ADMIN_EMAIL env var is not set.");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      return { userId: existing._id, created: false, activationToken: null };
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email,
      role: "admin",
      status: "active",
      createdVia: "seed",
      createdAt: now,
    });

    const token = crypto.randomUUID();
    await ctx.db.insert("provisioningTokens", {
      token,
      issuerId: userId,
      targetRole: "admin",
      email,
      maxUses: 1,
      usedCount: 0,
      expiresAt: now + 1000 * 60 * 60 * 24 * 14, // 14 days
      revoked: false,
      purpose: "activation",
      createdAt: now,
    });

    return { userId, created: true, activationToken: token };
  },
});
