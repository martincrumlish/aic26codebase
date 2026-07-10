// convex/authGate.ts
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
      throw new ConvexError("This account has been revoked.");
    }
    return args.existingUserId;
  }

  const email = (args.profile.email as string | undefined)?.toLowerCase().trim();
  if (!email) throw new ConvexError("Email is required to sign in.");

  // 2. Pre-seeded users row (webhook §4 / operator seed §7 / token activation).
  const seeded = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (seeded) {
    if (seeded.status === "revoked") {
      throw new ConvexError("This account has been revoked.");
    }
    await ctx.db.patch(seeded._id, {
      name: (args.profile.name as string) ?? seeded.name,
      emailVerificationTime:
        args.type === "email" ? Date.now() : seeded.emailVerificationTime,
    });
    return seeded._id;
  }

  // 3. Token-on-profile signup path (Password.profile() passes `token` through).
  //    Magic-link/email has no place to carry a token, so it cannot reach here
  //    with one → un-provisioned magic-link emails are rejected at the final throw.
  const tokenValue = (args.profile.token as string | undefined)?.trim();
  if (tokenValue) {
    const tok = await ctx.db
      .query("provisioningTokens")
      .withIndex("by_token", (q) => q.eq("token", tokenValue))
      .unique();
    const now = Date.now();
    if (
      tok &&
      tok.purpose === "signup" &&
      !tok.revoked &&
      tok.expiresAt > now &&
      tok.usedCount < tok.maxUses &&
      (!tok.email || tok.email.toLowerCase().trim() === email)
    ) {
      const userId = await ctx.db.insert("users", {
        email,
        name: (args.profile.name as string) ?? undefined,
        role: tok.targetRole,
        creatorId: tok.creatorScopeId,
        status: "active",
        createdVia: "token",
        createdAt: now,
      });
      await ctx.db.patch(tok._id, { usedCount: tok.usedCount + 1 });
      return userId;
    }
  }

  // 4. Otherwise reject — NO users row, NO authAccount, NO session.
  throw new ConvexError(
    "This email is not enabled for this app. Ask your administrator for an invite.",
  );
}
