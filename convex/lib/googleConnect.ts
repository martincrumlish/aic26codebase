// convex/lib/googleConnect.ts — "Connect Google" in Settings.
//
// When someone who is already signed in starts a Google sign-in, Convex Auth
// records their session on the pending sign-in (the "verifier"). When Google
// sends them back, this attaches the Google account to THAT signed-in account.
// It never matches by email, so it can't be used to get into someone else's
// account: the person has proved both the session and the Google account.
//
// Runs inside auth:store (see auth.ts) just before Convex Auth handles the
// Google callback; afterwards Convex Auth finds the Google account already
// linked and signs them in as the same user.
import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { GOOGLE_EMAIL_UNVERIFIED } from "./authMessages";

type StoreArgs = {
  type?: string;
  provider?: string;
  providerAccountId?: string;
  signature?: string;
  profile?: { email?: unknown; emailVerified?: unknown };
};

export async function connectGoogleIfSignedIn(ctx: MutationCtx, args: StoreArgs) {
  if (args.type !== "userOAuth" || args.provider !== "google" || !args.signature || !args.providerAccountId) return;
  const providerAccountId = args.providerAccountId;

  const verifier = await ctx.db
    .query("authVerifiers")
    .withIndex("signature", (q) => q.eq("signature", args.signature))
    .unique();
  if (!verifier?.sessionId) return; // signed out: the normal rules in authGate apply
  const session = await ctx.db.get(verifier.sessionId);
  if (!session || session.expirationTime < Date.now()) return;
  const user = await ctx.db.get(session.userId);
  if (!user || user.status === "revoked") return;

  const linked = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) => q.eq("provider", "google").eq("providerAccountId", providerAccountId))
    .unique();
  if (linked) {
    if (linked.userId !== user._id) {
      throw new ConvexError("That Google account is already connected to a different account.");
    }
    return; // already connected to this account
  }
  const existing = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "google"))
    .unique();
  if (existing) {
    throw new ConvexError("Your account already has a Google account connected. Disconnect it first.");
  }

  const email = typeof args.profile?.email === "string" ? args.profile.email.toLowerCase().trim() : undefined;
  if (args.profile?.emailVerified !== true || !email) throw new ConvexError(GOOGLE_EMAIL_UNVERIFIED);

  await ctx.db.insert("authAccounts", {
    userId: user._id,
    provider: "google",
    providerAccountId,
    emailVerified: email,
  });
  // Google proved this address; if it's the account's own, it now counts as confirmed.
  if (email === user.email && !user.emailVerificationTime) {
    await ctx.db.patch(user._id, { emailVerificationTime: Date.now() });
  }
}
