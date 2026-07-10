// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth system tables (users, authAccounts, authSessions,
  // authVerificationCodes, authVerifiers, authRateLimits, authRefreshTokens).
  // Spread FIRST, then re-declare `users` to add app fields.
  ...authTables,

  users: defineTable({
    // —— fields Convex Auth reads/writes (keep, all optional) ——
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // —— app fields (ALL optional — auth inserts bare {email} first) ——
    role: v.optional(
      v.union(v.literal("operator"), v.literal("creator"), v.literal("member")),
    ),
    creatorId: v.optional(v.id("users")),
    status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
    createdVia: v.optional(
      v.union(v.literal("seed"), v.literal("token"), v.literal("webhook")),
    ),
    createdAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_creator", ["creatorId"]),

  provisioningTokens: defineTable({
    token: v.string(),
    issuerId: v.id("users"),
    targetRole: v.union(
      v.literal("operator"),
      v.literal("creator"),
      v.literal("member"),
    ),
    creatorScopeId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    maxUses: v.optional(v.number()), // absent = unlimited uses (standing link)
    usedCount: v.number(),
    expiresAt: v.optional(v.number()), // absent = never expires; rotate manually

    revoked: v.boolean(),
    purpose: v.union(v.literal("signup"), v.literal("activation")),
    createdAt: v.number(),
  }).index("by_token", ["token"]),

  // BYOK AI provider keys. Write-only from the client: the raw `key` is never
  // returned by any public query — clients only ever see `last4` (getAiStatus).
  userApiKeys: defineTable({
    userId: v.id("users"),
    provider: v.literal("openrouter"),
    key: v.string(),
    last4: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  webhooks: defineTable({
    scope: v.string(),
    signingSecretRef: v.string(), // env-var NAME, never the secret value
    active: v.boolean(),
    rotatedAt: v.optional(v.number()),
  }).index("by_scope", ["scope"]),

  provisioningEvents: defineTable({
    externalId: v.string(),
    source: v.string(),
    type: v.string(),
    targetEmail: v.string(),
    role: v.union(
      v.literal("operator"),
      v.literal("creator"),
      v.literal("member"),
    ),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("failed"),
    ),
    userId: v.optional(v.id("users")),
    receivedAt: v.number(),
  }).index("by_externalId", ["externalId"]), // idempotency key
});
