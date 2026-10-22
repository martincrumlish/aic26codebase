// convex/lib/plan.ts — what plan a user is on, decided on the server from the
// subscriptions Stripe's webhook has synced. Never trust the browser for this.
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { components } from "../_generated/api";
import type { PlanId } from "./plans";

// Statuses that count as paid. "past_due" is deliberately excluded: Stripe is
// still retrying the card, and access returns automatically if it succeeds.
const PAID_STATUSES = new Set(["active", "trialing"]);

export type Subscription = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string;
  priceId: string;
  currentPeriodEnd: number; // seconds since epoch (as Stripe sends it)
  cancelAtPeriodEnd: boolean;
};

export async function getBilling(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const accounts = await ctx.db
    .query("billingAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(20);
  let paid: Subscription | null = null;
  let everSubscribed = false;
  for (const account of accounts) {
    const subs: Subscription[] = await ctx.runQuery(components.stripe.public.listSubscriptions, {
      stripeCustomerId: account.stripeCustomerId,
    });
    paid = subs.find((s) => PAID_STATUSES.has(s.status)) ?? paid;
    everSubscribed ||= subs.length > 0;
  }
  const plan: PlanId = paid ? "pro" : "free";
  return {
    plan,
    subscription: paid,
    // Had any subscription, in any state (trials included): "one free trial
    // per person".
    everSubscribed,
    // The customer to open the billing portal for: the paying one if any.
    stripeCustomerId: paid?.stripeCustomerId ?? accounts[0]?.stripeCustomerId ?? null,
  };
}

export async function getPlan(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<PlanId> {
  return (await getBilling(ctx, userId)).plan;
}
