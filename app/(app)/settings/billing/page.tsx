// app/(app)/settings/billing/page.tsx — Stripe Checkout and the billing
// portal both return here (convex/billing.ts).
import { Suspense } from "react";
import { BillingCard } from "@/components/billing/BillingCard";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function BillingSettingsPage() {
  return (
    <SettingsSection title="Billing" description="Your plan and payments.">
      {/* Suspense: BillingCard reads the URL (?billing=success). */}
      <Suspense fallback={null}>
        <BillingCard />
      </Suspense>
    </SettingsSection>
  );
}
