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
    limits: { projects: 3, appAiKey: false },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For people who use it every day.",
    features: ["Unlimited projects", "AI chat included (no key needed)", "Priority support"],
    limits: { projects: Infinity, appAiKey: true },
    // Amounts in the smallest currency unit (cents).
    price: proPrice,
  },
} as const;

export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}
