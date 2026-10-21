// convex/authGate.ts
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { GOOGLE_EMAIL_UNVERIFIED, GOOGLE_USE_PASSWORD, REVOKED, SIGNUP_REJECTED } from "./lib/authMessages";
import { signupMode } from "./lib/signupMode";
import { tokenIsUsable } from "./lib/tokens";

type Ctx = MutationCtx;
type Args = {
  existingUserId: Id<"users"> | null;
  type: "oauth" | "credentials" | "email" | "phone" | "verification";
  provider: { id: string };
  profile: Record<string, unknown> & { email?: string; token?: string };
  shouldLink?: boolean;
};

export default async function createOrUpdateUser(
  ctx: Ctx,
  args: Args,
): Promise<Id<"users">> {
  // 1. Already-linked account (returning sign-in) → allow; block revoked.
  if (args.existingUserId) {
    const u = await ctx.db.get(args.existingUserId);
    // Fail closed if the linked doc vanished (e.g. deleted user): never mint a
    // session for an id with no backing users row.
    if (!u) {
      throw new ConvexError("This account no longer exists.");
    }
    if (u.status === "revoked") {
      throw new ConvexError(REVOKED);
    }
    // Confirming the email by code: record it, so a later Google sign-in with
    // the same address can be linked to this account (see oauthUser).
    if (args.type === "verification" && args.profile.emailVerified === true && !u.emailVerificationTime) {
      await ctx.db.patch(u._id, { emailVerificationTime: Date.now() });
    }
    return args.existingUserId;
  }

  const email = (args.profile.email as string | undefined)?.toLowerCase().trim();
  if (!email) throw new ConvexError("Email is required to sign in.");

  // OAuth (Google): Google has already proved the email, so no tokens needed.
  if (args.type === "oauth") return await oauthUser(ctx, args, email);

  // The token comes from the sign-up form (Password.profile() passes it
  // through) or from a server-side createAccount call.
  const tokenValue = (args.profile.token as string | undefined)?.trim();
  const tok = tokenValue
    ? await ctx.db
        .query("provisioningTokens")
        .withIndex("by_token", (q) => q.eq("token", tokenValue))
        .unique()
    : null;
  const now = Date.now();

  // 2. Pre-created account (first admin, webhook customer, admin-added user).
  //    Knowing the email is NOT enough: only the holder of that account's own
  //    activation token may claim it, and the token is used up here, in the
  //    same transaction. Every failure gives the same message as an unknown
  //    email, so this can't be used to discover pre-created accounts.
  const seeded = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (seeded) {
    if (
      !tok ||
      tok.purpose !== "activation" ||
      !tokenIsUsable(tok, now) ||
      tok.email?.toLowerCase().trim() !== email
    ) {
      throw new ConvexError(NOT_ENABLED);
    }
    if (seeded.status === "revoked") {
      throw new ConvexError(REVOKED);
    }
    await ctx.db.patch(tok._id, { usedCount: tok.usedCount + 1 });
    await ctx.db.patch(seeded._id, {
      name: (args.profile.name as string) ?? seeded.name,
      emailVerificationTime:
        args.type === "email" ? now : seeded.emailVerificationTime,
    });
    return seeded._id;
  }

  // 3. New account through a signup link.
  if (
    tok &&
    tok.purpose === "signup" &&
    tokenIsUsable(tok, now) &&
    (!tok.email || tok.email.toLowerCase().trim() === email)
  ) {
    const userId = await ctx.db.insert("users", {
      email,
      name: (args.profile.name as string) ?? undefined,
      role: tok.targetRole,
      status: "active",
      createdVia: "token",
      createdAt: now,
    });
    await ctx.db.patch(tok._id, { usedCount: tok.usedCount + 1 });
    return userId;
  }

  // 4. Open sign-up (the default; see lib/signupMode.ts): anyone else gets a
  //    fresh account with role "user". Pre-created accounts never reach here —
  //    step 2 handled (and guarded) them above.
  if (signupMode() === "open") {
    return await ctx.db.insert("users", {
      email,
      name: (args.profile.name as string) ?? undefined,
      role: "user",
      status: "active",
      createdVia: "signup",
      createdAt: now,
    });
  }

  // 5. Otherwise reject — NO users row, NO authAccount, NO session.
  throw new ConvexError(NOT_ENABLED);
}

// Same message as an existing account gets (see auth.ts), so sign-up can't be
// used to discover which emails have accounts.
const NOT_ENABLED = SIGNUP_REJECTED;

/**
 * A first Google sign-in (returning ones are step 1 above).
 *
 * If the email already has an account, link to it only when nobody but the
 * email's owner can be holding a password for it: either it has no password
 * yet (pre-created) or it confirmed the email by code. Otherwise someone could
 * sign up with a victim's address first, wait for the victim to "Continue with
 * Google", and keep a working password into the victim's account.
 */
async function oauthUser(ctx: Ctx, args: Args, email: string): Promise<Id<"users">> {
  if (args.profile.emailVerified !== true) throw new ConvexError(GOOGLE_EMAIL_UNVERIFIED);
  const now = Date.now();
  const name = typeof args.profile.name === "string" ? args.profile.name : undefined;

  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (existing) {
    if (existing.status === "revoked") throw new ConvexError(REVOKED);
    const password = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", existing._id).eq("provider", "password"))
      .unique();
    const emailProven = !password || password.emailVerified !== undefined || existing.emailVerificationTime !== undefined;
    if (!emailProven) throw new ConvexError(GOOGLE_USE_PASSWORD);

    // The owner has now claimed it: void any activation links still out there
    // for this address, or their holder could set a password on it later.
    const tokens = await ctx.db
      .query("provisioningTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(50);
    for (const tok of tokens) {
      if (tok.purpose === "activation" && !tok.revoked) await ctx.db.patch(tok._id, { revoked: true });
    }
    await ctx.db.patch(existing._id, {
      name: existing.name ?? name,
      emailVerificationTime: existing.emailVerificationTime ?? now,
    });
    return existing._id;
  }

  // A new person: only where anyone may sign up (Google has no signup link).
  if (signupMode() !== "open") throw new ConvexError(NOT_ENABLED);
  return await ctx.db.insert("users", {
    email,
    name,
    role: "user",
    status: "active",
    createdVia: "signup",
    createdAt: now,
    emailVerificationTime: now,
  });
}

