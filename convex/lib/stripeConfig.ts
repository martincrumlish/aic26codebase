// convex/lib/stripeConfig.ts — Stripe settings from Convex env vars (set by
// `npm run setup:stripe`). Server-only.
import type { BillingInterval } from "./plans";

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

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
