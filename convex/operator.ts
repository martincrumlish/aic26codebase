// convex/operator.ts
import { action, internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { requireOperator } from "./access";

const CreatorRow = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  role: v.optional(
    v.union(v.literal("operator"), v.literal("creator"), v.literal("member")),
  ),
  status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
  createdAt: v.optional(v.number()),
});

export const listCreators = query({
  args: {},
  returns: v.array(CreatorRow),
  handler: async (ctx) => {
    await requireOperator(ctx);
    const rows = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "creator"))
      .collect();
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

// Standing signup links: no expiry, no use limit. Links stay live until the
// operator rotates them (revokeSignupToken + generate a fresh one).
export const generateCreatorToken = mutation({
  args: { email: v.optional(v.string()) },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    const operator = await requireOperator(ctx);
    const token = crypto.randomUUID();
    await ctx.db.insert("provisioningTokens", {
      token,
      issuerId: operator._id,
      targetRole: "creator",
      email: args.email?.toLowerCase().trim(),
      usedCount: 0,
      revoked: false,
      purpose: "signup",
      createdAt: Date.now(),
    });
    return { token };
  },
});

export const listSignupTokens = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("provisioningTokens"),
      token: v.string(),
      email: v.optional(v.string()),
      targetRole: v.union(
        v.literal("operator"),
        v.literal("creator"),
        v.literal("member"),
      ),
      usedCount: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireOperator(ctx);
    // Bounded page: tokens are operator-issued (small table), same cap as platformStats.
    const tokens = await ctx.db.query("provisioningTokens").order("desc").take(1000);
    const now = Date.now();
    return tokens
      .filter(
        (tk) =>
          tk.purpose === "signup" &&
          !tk.revoked &&
          (tk.expiresAt === undefined || tk.expiresAt > now) &&
          (tk.maxUses === undefined || tk.usedCount < tk.maxUses),
      )
      .map((tk) => ({
        _id: tk._id,
        token: tk.token,
        email: tk.email,
        targetRole: tk.targetRole,
        usedCount: tk.usedCount,
        createdAt: tk.createdAt,
      }));
  },
});

export const revokeSignupToken = mutation({
  args: { tokenId: v.id("provisioningTokens") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperator(ctx);
    const tok = await ctx.db.get(args.tokenId);
    if (!tok) throw new ConvexError("Link not found.");
    await ctx.db.patch(args.tokenId, { revoked: true });
    return null;
  },
});

export const revokeCreator = mutation({
  args: { creatorId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperator(ctx);
    const target = await ctx.db.get(args.creatorId);
    if (!target) throw new ConvexError("Creator not found.");
    if (target.role !== "creator") throw new ConvexError("Target is not a creator.");
    await ctx.db.patch(args.creatorId, { status: "revoked" });
    return null;
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
    await requireOperator(ctx);
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
    await requireOperator(ctx);
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

export const platformStats = query({
  args: {},
  returns: v.object({
    creators: v.number(),
    members: v.number(),
    activeTokens: v.number(),
  }),
  handler: async (ctx) => {
    await requireOperator(ctx);
    const creators = (
      await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "creator")).collect()
    ).length;
    const members = (
      await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "member")).collect()
    ).length;
    const now = Date.now();
    // Bounded page: stats only need an order-of-magnitude count and the token
    // table is admin-issued (small). 1000 caps the read without an extra index.
    const tokens = await ctx.db.query("provisioningTokens").take(1000);
    const activeTokens = tokens.filter(
      (tk) =>
        !tk.revoked &&
        (tk.expiresAt === undefined || tk.expiresAt > now) &&
        (tk.maxUses === undefined || tk.usedCount < tk.maxUses),
    ).length;
    return { creators, members, activeTokens };
  },
});

// ── Admin user management (operator-only) ────────────────────────────────────
//
// createUserAccount is an ACTION (not a mutation) because @convex-dev/auth's
// `createAccount` helper internally invokes the auth store mutation by name —
// that helper is only available on an ACTION ctx, never on a plain mutation ctx
// (verified in node_modules/@convex-dev/auth/.../createAccountFromCredentials.js,
// and convex-test only injects runQuery/runMutation/runAction into action ctxs).
// This mirrors the existing `password.changePassword` action.
//
// The flow is:
//   1. seedUserForAccount  (internal MUTATION, transactional) — operator gate +
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
    await requireOperator(ctx);

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
      role: "creator",
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

    // 1. Operator gate + validation + duplicate check + pre-seed (transactional).
    const { userId } = await ctx.runMutation(internal.operator.seedUserForAccount, {
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
      await ctx.runMutation(internal.operator.deleteSeededUser, { userId });
      throw err;
    }

    return { userId };
  },
});

// deleteUserAccount HARD-deletes a user and all their Convex Auth records.
//
// Tables touched (verified against schema.ts):
//   • App data: none yet — when the app adds owner-keyed tables, cascade them
//     here FIRST (delete by ownerId index, free any ctx.storage blobs).
//   • Convex Auth: authAccounts (userIdAndProvider), authVerificationCodes
//       (accountId), authSessions (userId), authRefreshTokens (sessionId)
//   • Finally: the users row.
export const deleteUserAccount = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operator = await requireOperator(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found.");

    // Guards.
    if (target._id === operator._id) {
      throw new ConvexError("You cannot delete your own account.");
    }
    if (target.role === "operator") {
      throw new ConvexError("Operators cannot be deleted here.");
    }

    const userId = args.userId;

    // ── 1. App-owned data cascade goes here. When the app adds owner-keyed
    // tables (e.g. projects/items with an ownerId index), delete those rows —
    // and free any ctx.storage blobs they hold — BEFORE the auth records.
    // userApiKeys: "by_user" index, keyed by [userId].
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

    // ── 5. Finally, the users row. authGate fails closed once it's gone. ──
    await ctx.db.delete(userId);
    return null;
  },
});
