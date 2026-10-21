// convex/ai.ts — BYOK OpenRouter key management.
//
// Write-only discipline: the raw key goes in via setOpenRouterKey and only
// ever comes back out through the INTERNAL getOpenRouterKeyForUser. Public
// reads (getAiStatus) expose last4 only.
//
// Key resolution order: user's own key → OPENROUTER_API_KEY env (if their plan
// includes it; Pro by default) → disabled. See lib/aiKey.ts.
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireUser, requireUserId } from "./access";
import { getAuthUserId } from "@convex-dev/auth/server";
import { resolveOpenRouterKey } from "./lib/aiKey";

// setOpenRouterKey is an ACTION because it validates the key with a live
// request to OpenRouter before saving (fetch is not available in mutations).
export const setOpenRouterKey = action({
  args: { key: v.string() },
  returns: v.object({ last4: v.string() }),
  handler: async (ctx, args): Promise<{ last4: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not signed in.");

    const key = args.key.trim();
    if (key.length < 8) throw new ConvexError("That doesn't look like an OpenRouter key.");

    // /api/v1/key is the authenticated key-info endpoint — a bad key gets 401.
    // (/api/v1/models is public and returns 200 without auth, so it cannot
    // validate anything.)
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      throw new ConvexError("OpenRouter rejected that key. Check it and try again.");
    }

    const { last4 } = await ctx.runMutation(internal.ai.saveOpenRouterKey, { key });
    return { last4 };
  },
});

/** Internal: persist the validated key (upsert — one row per user). */
export const saveOpenRouterKey = internalMutation({
  args: { key: v.string() },
  returns: v.object({ last4: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const last4 = args.key.slice(-4);
    const existing = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { key: args.key, last4 });
    } else {
      await ctx.db.insert("userApiKeys", {
        userId: user._id,
        provider: "openrouter",
        key: args.key,
        last4,
        createdAt: Date.now(),
      });
    }
    return { last4 };
  },
});

export const getAiStatus = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    source: v.optional(v.union(v.literal("own"), v.literal("app"))),
    last4: v.optional(v.string()),
    // True when the app has a key but the user's plan doesn't include it.
    appKeyNeedsPro: v.optional(v.boolean()),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const resolved = await resolveOpenRouterKey(ctx, user._id);
    if (resolved.key === null) {
      return resolved.appKeyNeedsPro ? { enabled: false, appKeyNeedsPro: true } : { enabled: false };
    }
    if (resolved.source === "own") return { enabled: true, source: "own" as const, last4: resolved.last4 };
    return { enabled: true, source: "app" as const };
  },
});

export const clearOpenRouterKey = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

/** Internal: raw key for server-side AI calls. NEVER expose to clients. */
export const getOpenRouterKeyForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return (await resolveOpenRouterKey(ctx, args.userId)).key;
  },
});
