// app/pricing/page.tsx — public pricing page (plans from convex/lib/plans.ts).
import Link from "next/link";
import { PricingPlans } from "@/components/billing/PricingPlans";
import { siteConfig } from "@/lib/site";

export default function PricingPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="font-semibold">{siteConfig.name}</Link>
        <Link href="/signin" className="text-sm text-muted-foreground hover:text-foreground">
          Sign in
        </Link>
      </header>
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pricing</h1>
          <p className="mt-2 text-muted-foreground">Start free. Upgrade when you need more.</p>
        </div>
        <PricingPlans />
      </section>
    </main>
  );
}
