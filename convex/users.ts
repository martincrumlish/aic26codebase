// convex/users.ts
import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./access";

export const currentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      phone: v.optional(v.string()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(
        v.union(v.literal("operator"), v.literal("creator"), v.literal("member")),
      ),
      creatorId: v.optional(v.id("users")),
      status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
      createdVia: v.optional(
        v.union(v.literal("seed"), v.literal("token"), v.literal("webhook")),
      ),
      createdAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/** Internal: fetch a user document by ID (used by the changePassword action). */
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      phone: v.optional(v.string()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(
        v.union(v.literal("operator"), v.literal("creator"), v.literal("member")),
      ),
      creatorId: v.optional(v.id("users")),
      status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
      createdVia: v.optional(
        v.union(v.literal("seed"), v.literal("token"), v.literal("webhook")),
      ),
      createdAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

export const updateProfile = mutation({
  args: { name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await ctx.db.patch(userId, { name: args.name });
    return null;
  },
});
