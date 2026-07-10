// convex/provisioning.ts
import { internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireOperator } from "./access";
import type { Id } from "./_generated/dataModel";

// —— Inbound webhook ingest (idempotent). Called from provisionHttp.ts. ——
export const ingestEvent = internalMutation({
  args: {
    externalId: v.string(),
    source: v.string(),
    type: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("operator"),
      v.literal("creator"),
      v.literal("member"),
    ),
    creatorScopeId: v.optional(v.string()),
  },
  returns: v.object({ deduped: v.boolean(), userId: v.id("users") }),
  handler: async (ctx, args) => {
    // Idempotency: dedup on event-row existence, not just on a resolved userId.
    const existing = await ctx.db
      .query("provisioningEvents")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
    if (existing) {
      if (existing.userId) {
        return { deduped: true, userId: existing.userId };
      }
      // Row exists from a prior FAILED attempt (no userId). Surface it rather
      // than inserting a duplicate event row and silently re-provisioning.
      throw new ConvexError(
        "A prior provisioning attempt for this event failed; manual review required.",
      );
    }

    const email = args.email.toLowerCase().trim();
    const creatorScope = args.creatorScopeId
      ? (ctx.db.normalizeId("users", args.creatorScopeId) ?? undefined)
      : undefined;

    // Find or create the pending users profile.
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    let userId: Id<"users">;
    if (user) {
      userId = user._id;
    } else {
      userId = await ctx.db.insert("users", {
        email,
        role: args.role,
        creatorId: creatorScope,
        status: "active",
        createdVia: "webhook",
        createdAt: Date.now(),
      });
    }

    // Single-use activation token (purpose "activation").
    const token = crypto.randomUUID(); // available in V8
    await ctx.db.insert("provisioningTokens", {
      token,
      issuerId: userId,
      targetRole: args.role,
      creatorScopeId: creatorScope,
      email,
      maxUses: 1,
      usedCount: 0,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
      revoked: false,
      purpose: "activation",
      createdAt: Date.now(),
    });

    await ctx.db.insert("provisioningEvents", {
      externalId: args.externalId,
      source: args.source,
      type: args.type,
      targetEmail: email,
      role: args.role,
      status: "processed",
      userId,
      receivedAt: Date.now(),
    });

    return { deduped: false, userId };
  },
});

// —— Operator-issued signup token (e.g. creator invite link). ——
export const createSignupToken = mutation({
  args: {
    targetRole: v.union(v.literal("creator"), v.literal("member")),
    email: v.optional(v.string()),
    creatorScopeId: v.optional(v.id("users")),
    maxUses: v.optional(v.number()),
    ttlDays: v.optional(v.number()),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    const operator = await requireOperator(ctx);
    const token = crypto.randomUUID();
    const now = Date.now();
    await ctx.db.insert("provisioningTokens", {
      token,
      issuerId: operator._id,
      targetRole: args.targetRole,
      creatorScopeId: args.creatorScopeId,
      email: args.email?.toLowerCase().trim(),
      // Standing links by default: no expiry, no use limit. Pass maxUses
      // and/or ttlDays for one-off or time-boxed invites.
      maxUses: args.maxUses,
      usedCount: 0,
      expiresAt: args.ttlDays !== undefined ? now + 1000 * 60 * 60 * 24 * args.ttlDays : undefined,
      revoked: false,
      purpose: "signup",
      createdAt: now,
    });
    return { token };
  },
});

// —— Public token validation for /join and /activate page render. ——
export const validateToken = query({
  args: { token: v.string() },
  returns: v.object({
    valid: v.boolean(),
    reason: v.optional(v.string()),
    purpose: v.optional(v.union(v.literal("signup"), v.literal("activation"))),
    email: v.optional(v.string()),
    targetRole: v.optional(
      v.union(v.literal("operator"), v.literal("creator"), v.literal("member")),
    ),
  }),
  handler: async (ctx, args) => {
    const tok = await ctx.db
      .query("provisioningTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!tok) return { valid: false, reason: "Unknown link." };
    if (tok.revoked) return { valid: false, reason: "This link was revoked." };
    if (tok.expiresAt !== undefined && tok.expiresAt <= Date.now()) return { valid: false, reason: "This link has expired." };
    if (tok.maxUses !== undefined && tok.usedCount >= tok.maxUses) return { valid: false, reason: "This link has already been used." };
    return {
      valid: true,
      purpose: tok.purpose,
      email: tok.email,
      targetRole: tok.targetRole,
    };
  },
});

// —— Consume an ACTIVATION token: pre-seed/link the users row so the gated
//    auth flow (authGate step 2) accepts the email, then mark consumed. The
//    client then calls signIn("password", { flow: "signUp", email, password }).
export const consumeActivationToken = mutation({
  args: { token: v.string(), email: v.string() },
  returns: v.object({ ok: v.boolean(), email: v.string() }),
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const tok = await ctx.db
      .query("provisioningTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    const now = Date.now();
    if (
      !tok ||
      tok.purpose !== "activation" ||
      tok.revoked ||
      (tok.expiresAt !== undefined && tok.expiresAt <= now) ||
      (tok.maxUses !== undefined && tok.usedCount >= tok.maxUses)
    ) {
      throw new ConvexError("This activation link is no longer valid.");
    }
    if (tok.email && tok.email.toLowerCase().trim() !== email) {
      throw new ConvexError("This activation link is for a different email.");
    }
    // Ensure a pre-seeded users row exists (webhook usually created it).
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!existing) {
      await ctx.db.insert("users", {
        email,
        role: tok.targetRole,
        creatorId: tok.creatorScopeId,
        status: "active",
        createdVia: "webhook",
        createdAt: now,
      });
    } else if (existing.status === "revoked") {
      throw new ConvexError("This account has been revoked.");
    }
    await ctx.db.patch(tok._id, { usedCount: tok.usedCount + 1 });
    return { ok: true, email };
  },
});
