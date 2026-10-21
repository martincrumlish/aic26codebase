// convex/google.ts — the Google card in Settings: is Google connected, and
// disconnecting it. Connecting happens through the normal Google sign-in while
// signed in (see lib/googleConnect.ts).
import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./access";

export const status = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    connected: v.boolean(),
    email: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const enabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "google"))
      .unique();
    return account ? { enabled, connected: true, email: account.emailVerified } : { enabled, connected: false };
  },
});

export const disconnect = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "google"))
      .unique();
    if (!account) return null;
    const password = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "password"))
      .unique();
    if (!password) {
      throw new ConvexError("Google is the only way you sign in, so it can't be disconnected.");
    }
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .take(10);
    for (const c of codes) await ctx.db.delete(c._id);
    await ctx.db.delete(account._id);
    return null;
  },
});
