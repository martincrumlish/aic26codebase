// convex/authGate.ts
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { REVOKED, SIGNUP_REJECTED } from "./lib/authMessages";

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
    return args.existingUserId;
  }

  const email = (args.profile.email as string | undefined)?.toLowerCase().trim();
  if (!email) throw new ConvexError("Email is required to sign in.");

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
      !isUsable(tok, now) ||
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
    isUsable(tok, now) &&
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

  // 4. Otherwise reject — NO users row, NO authAccount, NO session.
  throw new ConvexError(NOT_ENABLED);
}

// Same message as an existing account gets (see auth.ts), so sign-up can't be
// used to discover which emails have accounts.
const NOT_ENABLED = SIGNUP_REJECTED;

function isUsable(tok: Doc<"provisioningTokens">, now: number) {
  return (
    !tok.revoked &&
    (tok.expiresAt === undefined || tok.expiresAt > now) &&
    (tok.maxUses === undefined || tok.usedCount < tok.maxUses)
  );
}
