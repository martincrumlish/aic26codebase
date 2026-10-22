// convex/lib/plans.ts — your plans, in one place. Shared by the backend (limits)
// and the pricing/settings pages (names, prices, features).
//
// Pro's prices live in proPrice.json (amounts in cents) so `npm run
// setup:stripe` can read them too: change them there and re-run it to create
// matching Stripe prices.
import proPrice from "./proPrice.json";

export type PlanId = "free" | "pro";
export type BillingInterval = "monthly" | "yearly";

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    description: "Everything you need to try it out.",
    features: ["Up to 3 projects", "AI chat with your own OpenRouter key"],
    // appAiKey: may this plan use the app's OPENROUTER_API_KEY? (Free: no, so
    // the allowance below only matters if you turn it on.)
    // appAiMessagesPerMonth: messages a month on the app's key. Messages on a
    // user's own key are never limited.
    limits: { projects: 3, appAiKey: false, appAiMessagesPerMonth: 25 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For people who use it every day.",
    features: ["Unlimited projects", "1,000 AI messages a month included (no key needed)", "Priority support"],
    limits: { projects: Infinity, appAiKey: true, appAiMessagesPerMonth: 1000 },
    // Amounts in the smallest currency unit (cents).
    price: proPrice,
    // Free trial at checkout, in days (0 = no trial). One per person: anyone
    // who has subscribed before pays from day one. Stripe takes their card up
    // front and charges it when the trial ends unless they cancel.
    trialDays: 14,
    // Let buyers enter a promotion code at checkout. Create the codes in the
    // Stripe dashboard (Product catalog > Coupons).
    promotionCodes: true,
  },
} as const;

export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}
