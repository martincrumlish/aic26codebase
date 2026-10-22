// convex/billing.ts — Stripe subscriptions (Free / Pro) via @convex-dev/stripe.
//
// - Signed-in users upgrade with `checkout` and manage/cancel with `portal`.
// - Signed-out buyers can pay first with `guestCheckout`; the webhook
//   (http.ts) then calls `provisionPurchase` to create their account, and the
//   /welcome page reads `welcome` to hand them their activation link.
// - The plan is decided on the server (lib/plan.ts) from the subscriptions the
//   Stripe component syncs. Gate paid features with requirePro (access.ts).
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { StripeSubscriptions } from "@convex-dev/stripe";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./access";
import { getBilling } from "./lib/plan";
import { billingConfigured, createProCheckout, intervalOfPrice, siteUrl } from "./lib/stripeConfig";
import { PLANS } from "./lib/plans";
import { tokenIsUsable } from "./lib/tokens";
import { enforce } from "./lib/rateLimits";

const Interval = v.union(v.literal("monthly"), v.literal("yearly"));

const NOT_CONFIGURED = "Billing isn't set up for this app yet. Run `npm run setup:stripe`.";

const stripe = new StripeSubscriptions(components.stripe, {});

// ── Reads ────────────────────────────────────────────────────────────────────

/** Public on purpose: the pricing page shows whether buying is possible. */
export const enabled = query({
  args: {},
  returns: v.boolean(),
  handler: async () => billingConfigured(),
});

export const status = query({
  args: {},
  returns: v.object({
    plan: v.union(v.literal("free"), v.literal("pro")),
    billingEnabled: v.boolean(),
    hasBillingAccount: v.boolean(),
    interval: v.optional(Interval),
    renewsAt: v.optional(v.number()), // ms since epoch (while trialing: when the trial ends)
    cancelAtPeriodEnd: v.optional(v.boolean()),
    trialing: v.optional(v.boolean()),
    // Days of free trial an upgrade would start with (0: none, or used already).
    trialDays: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const { plan, subscription, stripeCustomerId, everSubscribed } = await getBilling(ctx, user._id);
    return {
      plan,
      billingEnabled: billingConfigured(),
      hasBillingAccount: stripeCustomerId !== null,
      interval: subscription ? intervalOfPrice(subscription.priceId) : undefined,
      renewsAt: subscription ? subscription.currentPeriodEnd * 1000 : undefined,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
      trialing: subscription ? subscription.status === "trialing" : undefined,
      trialDays: plan === "free" && !everSubscribed ? PLANS.pro.trialDays : 0,
    };
  },
});

/** Internal: the signed-in user's billing details, for the actions below. */
export const me = internalQuery({
  args: {},
  returns: v.object({
    userId: v.id("users"),
    email: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro")),
    stripeCustomerId: v.union(v.string(), v.null()),
    trialEligible: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const { plan, stripeCustomerId, everSubscribed } = await getBilling(ctx, user._id);
    return { userId: user._id, email: user.email, plan, stripeCustomerId, trialEligible: !everSubscribed };
  },
});

// ── Signed-in: upgrade and manage ────────────────────────────────────────────

export const checkout = action({
  args: { interval: Interval },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const me: {
      userId: Id<"users">;
      email?: string;
      plan: string;
      stripeCustomerId: string | null;
      trialEligible: boolean;
    } = await ctx.runQuery(internal.billing.me, {});
    if (!billingConfigured()) throw new ConvexError(NOT_CONFIGURED);
    await enforce(ctx, "checkout", me.userId);
    if (me.plan === "pro") {
      throw new ConvexError("You're already on Pro. Manage your plan from Settings.");
    }

    const customerId =
      me.stripeCustomerId ??
      (await stripe.getOrCreateCustomer(ctx, { userId: me.userId, email: me.email })).customerId;
    await ctx.runMutation(internal.billing.linkCustomer, {
      userId: me.userId,
      stripeCustomerId: customerId,
    });

    const url = await createProCheckout({
      interval: args.interval,
      trial: me.trialEligible,
      customerId,
      successUrl: `${siteUrl()}/settings/billing?billing=success`,
      cancelUrl: `${siteUrl()}/pricing`,
      metadata: { userId: me.userId },
      subscriptionMetadata: { userId: me.userId },
    });
    return { url };
  },
});

export const portal = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx): Promise<{ url: string }> => {
    const me: { userId: Id<"users">; stripeCustomerId: string | null } = await ctx.runQuery(internal.billing.me, {});
    if (!billingConfigured()) throw new ConvexError(NOT_CONFIGURED);
    await enforce(ctx, "checkout", me.userId);
    if (!me.stripeCustomerId) {
      throw new ConvexError("You don't have a billing account yet, so there's nothing to manage.");
    }
    return await stripe.createCustomerPortalSession(ctx, {
      customerId: me.stripeCustomerId,
      returnUrl: `${siteUrl()}/settings/billing`,
    });
  },
});

/** Internal: remember which Stripe customer belongs to a user. */
export const linkCustomer = internalMutation({
  args: { userId: v.id("users"), stripeCustomerId: v.string(), checkoutSessionId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingAccounts")
      .withIndex("by_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .take(10);
    if (!existing.some((a) => a.userId === args.userId)) {
      await ctx.db.insert("billingAccounts", args);
    }
    return null;
  },
});

// ── Signed-out: pay first, account second ────────────────────────────────────

/** Public on purpose: lets a signed-out visitor start a Pro purchase. */
export const guestCheckout = action({
  args: { interval: Interval },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (!billingConfigured()) throw new ConvexError(NOT_CONFIGURED);
    await enforce(ctx, "guestCheckout");
    const url = await createProCheckout({
      interval: args.interval,
      // A signed-out buyer can't be identified until they've paid, so they
      // always get the trial. (Someone with an old account buying this way
      // could get a second one; signed-in upgrades are checked.)
      trial: true,
      // Stripe fills in {CHECKOUT_SESSION_ID}; /welcome uses it to find the account.
      successUrl: `${siteUrl()}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl()}/pricing`,
      metadata: { guest: "1" },
    });
    return { url };
  },
});

/**
 * Internal (called by the Stripe webhook when a guest checkout completes):
 * create the buyer's account, or attach the purchase to an existing one.
 * Idempotent per checkout session, since Stripe retries webhooks.
 */
export const provisionPurchase = internalMutation({
  args: { checkoutSessionId: v.string(), email: v.string(), stripeCustomerId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const done = await ctx.db
      .query("billingAccounts")
      .withIndex("by_checkout_session", (q) => q.eq("checkoutSessionId", args.checkoutSessionId))
      .first();
    if (done) return null;

    const email = args.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      // Never hand an activation link for an EXISTING account to whoever paid:
      // Stripe doesn't verify emails, so that would let anyone who pays claim
      // someone else's not-yet-activated account. The purchase is attached;
      // the owner signs in (or activates) the way they already could.
      await ctx.db.insert("billingAccounts", {
        userId: existing._id,
        stripeCustomerId: args.stripeCustomerId,
        checkoutSessionId: args.checkoutSessionId,
      });
      return null;
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email,
      role: "user",
      status: "active",
      createdVia: "webhook",
      createdAt: now,
    });
    const token = crypto.randomUUID();
    await ctx.db.insert("provisioningTokens", {
      token,
      issuerId: userId,
      targetRole: "user",
      email,
      maxUses: 1,
      usedCount: 0,
      expiresAt: now + 1000 * 60 * 60 * 24 * 7, // 7 days
      revoked: false,
      purpose: "activation",
      createdAt: now,
      checkoutSessionId: args.checkoutSessionId,
    });
    await ctx.db.insert("billingAccounts", {
      userId,
      stripeCustomerId: args.stripeCustomerId,
      checkoutSessionId: args.checkoutSessionId,
    });
    // Also email the link, if email is set up (the /welcome page shows it too).
    await ctx.scheduler.runAfter(0, internal.email.send, {
      to: email,
      subject: "Your account is ready",
      html: [
        `<p>Thanks for your purchase! Set a password to start using your account:</p>`,
        `<p><a href="${siteUrl()}/activate/${token}">Activate your account</a></p>`,
      ].join("\n"),
    });
    return null;
  },
});

/**
 * Public on purpose: the /welcome page after a guest checkout. Only someone
 * holding the Checkout session id (Stripe puts it in the redirect URL) can
 * look it up. Updates live: "processing" until the webhook has run.
 */
export const welcome = query({
  args: { checkoutSessionId: v.string() },
  returns: v.object({
    status: v.union(v.literal("processing"), v.literal("activate"), v.literal("signin")),
    activationToken: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("billingAccounts")
      .withIndex("by_checkout_session", (q) => q.eq("checkoutSessionId", args.checkoutSessionId))
      .first();
    if (!link) return { status: "processing" as const };
    const tok = await ctx.db
      .query("provisioningTokens")
      .withIndex("by_checkout_session", (q) => q.eq("checkoutSessionId", args.checkoutSessionId))
      .first();
    if (tok && tok.purpose === "activation" && tokenIsUsable(tok)) {
      return { status: "activate" as const, activationToken: tok.token };
    }
    return { status: "signin" as const };
  },
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

/** Internal: cancel all live subscriptions for these customers (user deleted). */
export const cancelSubscriptions = internalAction({
  args: { stripeCustomerIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const stripeCustomerId of args.stripeCustomerIds) {
      const subs = await ctx.runQuery(components.stripe.public.listSubscriptions, { stripeCustomerId });
      for (const sub of subs) {
        if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;
        await stripe.cancelSubscription(ctx, {
          stripeSubscriptionId: sub.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        });
      }
    }
    return null;
  },
});
