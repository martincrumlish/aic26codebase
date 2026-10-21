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
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
    createdVia: v.optional(
      v.union(v.literal("seed"), v.literal("token"), v.literal("webhook"), v.literal("signup")),
    ),
    createdAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  provisioningTokens: defineTable({
    token: v.string(),
    issuerId: v.id("users"),
    targetRole: v.union(v.literal("admin"), v.literal("user")),
    email: v.optional(v.string()),
    maxUses: v.optional(v.number()), // absent = unlimited uses (standing link)
    usedCount: v.number(),
    expiresAt: v.optional(v.number()), // absent = never expires; rotate manually

    revoked: v.boolean(),
    purpose: v.union(v.literal("signup"), v.literal("activation")),
    createdAt: v.number(),
    // Set when a guest checkout created this account (see billing.ts).
    checkoutSessionId: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_checkout_session", ["checkoutSessionId"]),

  // Which Stripe customer(s) belong to which user. The plan is decided from
  // these customers' subscriptions (synced by the Stripe component's webhook),
  // which works whatever order Stripe's events arrive in.
  billingAccounts: defineTable({
    userId: v.id("users"),
    stripeCustomerId: v.string(),
    // Set when the account came from a guest ("pay first") checkout.
    checkoutSessionId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_customer", ["stripeCustomerId"])
    .index("by_checkout_session", ["checkoutSessionId"]),

  // BYOK AI provider keys. Write-only from the client: the raw `key` is never
  // returned by any public query — clients only ever see `last4` (getAiStatus).
  userApiKeys: defineTable({
    userId: v.id("users"),
    provider: v.literal("openrouter"),
    key: v.string(),
    last4: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // The example feature (see convex/projects.ts). Copy this shape for your own
  // user-owned data: an owner id with an index on it.
  projects: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    attachmentId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // AI chat (see convex/chat.ts). One row per conversation; `updatedAt` moves
  // with every message so the list can sort by recent activity.
  conversations: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    model: v.string(), // an OpenRouter model id from lib/aiModels.ts
    updatedAt: v.number(),
  }).index("by_owner_updated", ["ownerId", "updatedAt"]),

  // An assistant reply is written while it streams: `content` grows and
  // `status` goes "streaming" → "done" (or "error" with a message).
  chatMessages: defineTable({
    conversationId: v.id("conversations"),
    ownerId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.union(v.literal("streaming"), v.literal("done"), v.literal("error")),
    error: v.optional(v.string()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_owner", ["ownerId"]),

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
    role: v.union(v.literal("admin"), v.literal("user")),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("failed"),
    ),
    userId: v.optional(v.id("users")),
    receivedAt: v.number(),
  }).index("by_externalId", ["externalId"]), // idempotency key
});
