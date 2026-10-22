// convex/lib/stripeConfig.ts — Stripe settings from Convex env vars (set by
// `npm run setup:stripe`). Server-only.
import Stripe from "stripe";
import { PLANS, type BillingInterval } from "./plans";

export function billingConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_PRO_MONTHLY &&
    process.env.STRIPE_PRICE_PRO_YEARLY
  );
}

export function proPriceId(interval: BillingInterval): string {
  const id =
    interval === "yearly"
      ? process.env.STRIPE_PRICE_PRO_YEARLY
      : process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!id) throw new Error(`Missing Stripe price for ${interval}`);
  return id;
}

export function intervalOfPrice(priceId: string): BillingInterval | undefined {
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return "monthly";
  if (priceId === process.env.STRIPE_PRICE_PRO_YEARLY) return "yearly";
  return undefined;
}

/**
 * Start a Stripe Checkout for Pro, with the free trial (when `trial` is true)
 * and promotion codes set in plans.ts. Done with Stripe's SDK directly because
 * the Stripe component's createCheckoutSession can't set either.
 */
export async function createProCheckout(opts: {
  interval: BillingInterval;
  trial: boolean;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  subscriptionMetadata?: Record<string, string>;
}): Promise<string> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const trialDays = opts.trial ? PLANS.pro.trialDays : 0;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: proPriceId(opts.interval), quantity: 1 }],
    customer: opts.customerId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: opts.metadata,
    allow_promotion_codes: PLANS.pro.promotionCodes || undefined,
    subscription_data: {
      metadata: opts.subscriptionMetadata,
      trial_period_days: trialDays > 0 ? trialDays : undefined,
    },
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout URL.");
  return session.url;
}

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
