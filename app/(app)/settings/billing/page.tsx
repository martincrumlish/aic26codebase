// app/(app)/settings/billing/page.tsx — Stripe Checkout and the billing
// portal both return here (convex/billing.ts).
import { Suspense } from "react";
import { BillingCard } from "@/components/billing/BillingCard";

export default function BillingSettingsPage() {
  return (
    // Suspense: BillingCard reads the URL (?billing=success).
    <Suspense fallback={null}>
      <BillingCard />
    </Suspense>
  );
}
