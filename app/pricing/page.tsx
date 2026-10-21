// app/pricing/page.tsx — public pricing page (plans from convex/lib/plans.ts).
import { PricingPlans } from "@/components/billing/PricingPlans";
import { SiteFooter, SiteHeader } from "@/components/landing/SiteChrome";

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-sidebar text-white">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-12 sm:px-6 md:pt-16">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Pricing</h1>
          <p className="mt-3 text-lg text-white/70">Start free. Upgrade when you need more.</p>
        </div>
        <PricingPlans />
        <p className="mt-8 text-center text-sm text-white/50">
          Prices in USD. Cancel any time from your billing settings.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
