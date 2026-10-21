// convex/admin.ts — admin console backend. Every function is admin-only.
import { action, internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./access";

const Role = v.union(v.literal("admin"), v.literal("user"));

// Bounded reads: users and signup links are listed in full on one admin page.
// Past a few thousand users, switch these to .paginate().
const LIST_CAP = 1000;

function isActiveSignupLink(tk: Doc<"provisioningTokens">, now: number) {
  return (
    tk.purpose === "signup" &&
    !tk.revoked &&
    (tk.expiresAt === undefined || tk.expiresAt > now) &&
    (tk.maxUses === undefined || tk.usedCount < tk.maxUses)
  );
}

// ── Users ────────────────────────────────────────────────────────────────────

export const listUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      role: v.optional(Role),
      status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
      createdAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("users").order("desc").take(LIST_CAP);
    return rows.map((u) => ({
      _id: u._id,
      _creationTime: u._creationTime,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    }));
  },
});

// Admins can't be revoked or deleted directly: remove their admin rights
// first. That keeps one admin from silently locking out another.
async function requireManageableTarget(
  ctx: Parameters<typeof requireAdmin>[0],
  adminId: Id<"users">,
  targetId: Id<"users">,
  verb: string,
) {
  const target = await ctx.db.get(targetId);
  if (!target) throw new ConvexError("User not found.");
  if (target._id === adminId) {
    throw new ConvexError(`You cannot ${verb} your own account.`);
  }
  if (target.role === "admin") {
    throw new ConvexError(`Remove admin rights before you ${verb} this account.`);
  }
  return target;
}

export const revokeUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await requireManageableTarget(ctx, admin._id, args.userId, "revoke");
    await ctx.db.patch(args.userId, { status: "revoked" });
    return null;
  },
});

export const restoreUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found.");
    await ctx.db.patch(args.userId, { status: "active" });
    return null;
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: Role },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.userId === admin._id) {
      throw new ConvexError("You cannot change your own role.");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found.");
    await ctx.db.patch(args.userId, { role: args.role });
    return null;
  },
});

// ── Signup links ─────────────────────────────────────────────────────────────
// Standing by default: no expiry, no use limit. Links stay live until an admin
// rotates them (revokeSignupLink + create a fresh one). Pass maxUses and/or
// ttlDays for a one-off or time-boxed invite. Links only ever create role
// "user" — admin rights are granted separately with setUserRole.

export const createSignupLink = mutation({
  args: {
    email: v.optional(v.string()),
    maxUses: v.optional(v.number()),
    ttlDays: v.optional(v.number()),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const token = crypto.randomUUID();
    const now = Date.now();
    await ctx.db.insert("provisioningTokens", {
      token,
      issuerId: admin._id,
      targetRole: "user",
      email: args.email?.toLowerCase().trim() || undefined,
      maxUses: args.maxUses,
      usedCount: 0,
      expiresAt:
        args.ttlDays !== undefined ? now + 1000 * 60 * 60 * 24 * args.ttlDays : undefined,
      revoked: false,
      purpose: "signup",
      createdAt: now,
    });
    return { token };
  },
});

export const listSignupLinks = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("provisioningTokens"),
      token: v.string(),
      email: v.optional(v.string()),
      usedCount: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tokens = await ctx.db.query("provisioningTokens").order("desc").take(LIST_CAP);
    const now = Date.now();
    return tokens
      .filter((tk) => isActiveSignupLink(tk, now))
      .map((tk) => ({
        _id: tk._id,
        token: tk.token,
        email: tk.email,
        usedCount: tk.usedCount,
        createdAt: tk.createdAt,
      }));
  },
});

export const revokeSignupLink = mutation({
  args: { linkId: v.id("provisioningTokens") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const tok = await ctx.db.get(args.linkId);
    if (!tok) throw new ConvexError("Link not found.");
    await ctx.db.patch(args.linkId, { revoked: true });
    return null;
  },
});

// ── Stats & webhook config ───────────────────────────────────────────────────

export const platformStats = query({
  args: {},
  returns: v.object({
    users: v.number(),
    admins: v.number(),
    activeLinks: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = (
      await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "user")).take(LIST_CAP)
    ).length;
    const admins = (
      await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(LIST_CAP)
    ).length;
    const now = Date.now();
    const tokens = await ctx.db.query("provisioningTokens").take(LIST_CAP);
    const activeLinks = tokens.filter((tk) => isActiveSignupLink(tk, now)).length;
    return { users, admins, activeLinks };
  },
});

export const getWebhookInfo = query({
  args: {},
  returns: v.object({
    endpointPath: v.string(),
    secretSet: v.boolean(),
    rotatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const hook = await ctx.db
      .query("webhooks")
      .withIndex("by_scope", (q) => q.eq("scope", "provision"))
      .first();
    return {
      // The site-domain origin is shown in the UI; here we return the path.
      endpointPath: "/provision",
      secretSet: !!process.env.PROVISION_WEBHOOK_SECRET,
      rotatedAt: hook?.rotatedAt ?? null,
    };
  },
});

export const rotateWebhookSecret = mutation({
  args: {},
  returns: v.object({ rotatedAt: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // The actual secret lives in a Convex env var (PROVISION_WEBHOOK_SECRET) and
    // is rotated out-of-band via `npx convex env set`. Here we record the rotation
    // intent + timestamp on the webhooks row so the console reflects it.
    const now = Date.now();
    const hook = await ctx.db
      .query("webhooks")
      .withIndex("by_scope", (q) => q.eq("scope", "provision"))
      .first();
    if (hook) {
      await ctx.db.patch(hook._id, { rotatedAt: now });
    } else {
      await ctx.db.insert("webhooks", {
        scope: "provision",
        signingSecretRef: "PROVISION_WEBHOOK_SECRET",
        active: true,
        rotatedAt: now,
      });
    }
    return { rotatedAt: now };
  },
});

// ── Create a user account directly ───────────────────────────────────────────
//
// createUserAccount is an ACTION (not a mutation) because @convex-dev/auth's
// `createAccount` helper internally invokes the auth store mutation by name —
// that helper is only available on an ACTION ctx, never on a plain mutation ctx
// (verified in node_modules/@convex-dev/auth/.../createAccountFromCredentials.js,
// and convex-test only injects runQuery/runMutation/runAction into action ctxs).
// This mirrors the existing `password.changePassword` action.
//
// The flow is:
//   1. seedUserForAccount  (internal MUTATION, transactional) — admin gate +
//      validation + duplicate check + PRE-SEED the users row. Pre-seeding is
//      REQUIRED: createAccount → upsertUserAndAccount → our authGate callback,
//      which (with existingUserId=null and no provisioning token) only succeeds
//      if it finds a pre-seeded users row by email; otherwise it throws.
//   2. createAccount  (in the action) — creates the password authAccounts row
//      and links it to the seeded users row via authGate step 2.
//   3. On failure after the seed, the action best-effort deletes the orphaned
//      seeded row (actions are NOT transactional, unlike mutations).

const MIN_PASSWORD_LENGTH = 8;

export const seedUserForAccount = internalMutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    password: v.string(),
  },
  returns: v.object({ userId: v.id("users") }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const email = args.email.toLowerCase().trim();
    if (!email.includes("@")) {
      throw new ConvexError("A valid email is required.");
    }
    if (args.password.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError("Password must be at least 8 characters.");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      throw new ConvexError("An account with that email already exists.");
    }

    const userId = await ctx.db.insert("users", {
      email,
      name: args.name,
      role: "user",
      status: "active",
      createdVia: "seed",
      createdAt: Date.now(),
    });
    return { userId };
  },
});

/** Internal: best-effort delete of a seeded users row if createAccount fails. */
export const deleteSeededUser = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.userId);
    if (existing) await ctx.db.delete(args.userId);
    return null;
  },
});

export const createUserAccount = action({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    password: v.string(),
  },
  returns: v.object({ userId: v.id("users") }),
  handler: async (ctx, args): Promise<{ userId: Id<"users"> }> => {
    const email = args.email.toLowerCase().trim();
    const name = args.name;

    // 1. Admin gate + validation + duplicate check + pre-seed (transactional).
    const { userId } = await ctx.runMutation(internal.admin.seedUserForAccount, {
      email,
      name,
      password: args.password,
    });

    // 2. Create the password credential so the account can sign in immediately.
    //    Provider id is "password" (the Password provider's hardcoded id, no
    //    explicit id set in auth.ts). authGate links the new authAccount to the
    //    pre-seeded users row by email (step 2 of authGate).
    try {
      await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: args.password },
        profile: { email, name },
      });
    } catch (err) {
      // Actions are not transactional — roll back the pre-seeded row by hand so
      // a failed credential creation never leaves an orphaned users row.
      await ctx.runMutation(internal.admin.deleteSeededUser, { userId });
      throw err;
    }

    return { userId };
  },
});

// ── Delete a user ────────────────────────────────────────────────────────────
//
// deleteUserAccount HARD-deletes a user and all their data.
//
// Tables touched (verified against schema.ts):
//   • App data: userApiKeys (by_user). When you add owner-keyed tables, cascade
//     them here FIRST (delete by owner index, free any ctx.storage blobs).
//   • Convex Auth: authAccounts (userIdAndProvider), authVerificationCodes
//       (accountId), authSessions (userId), authRefreshTokens (sessionId)
//   • Finally: the users row.
export const deleteUserAccount = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await requireManageableTarget(ctx, admin._id, args.userId, "delete");

    const userId = args.userId;

    // ── 1. App-owned data. Add new owner-keyed tables here.
    const apiKeys = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(apiKeys.map((k) => ctx.db.delete(k._id)));

    // ── 2. Convex Auth records (so the user can't sign in & no stale rows) ──
    // authAccounts: "userIdAndProvider" index, keyed by [userId, provider].
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      // authVerificationCodes are keyed by accountId ("accountId" index).
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      await Promise.all(codes.map((c) => ctx.db.delete(c._id)));
      await ctx.db.delete(account._id);
    }

    // authSessions: "userId" index. Each session's refresh tokens go too.
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      // authRefreshTokens: "sessionId" index, keyed by sessionId.
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      await Promise.all(refreshTokens.map((rt) => ctx.db.delete(rt._id)));
      await ctx.db.delete(session._id);
    }
    // authVerifiers (PKCE/OAuth) only carry an optional sessionId and have no
    // by-session index — a full scan would be a table-scan violation, and a
    // verifier with no live session is inert. We deleted the sessions above, so
    // we intentionally leave any lingering verifiers rather than scan the table.

    // ── 3. Finally, the users row. authGate fails closed once it's gone. ──
    await ctx.db.delete(userId);
    return null;
  },
});
