// app/welcome/page.tsx — where Stripe Checkout sends a signed-out buyer.
import { AuthSplit } from "@/components/auth/AuthSplit";
import { WelcomeAfterPurchase } from "@/components/billing/WelcomeAfterPurchase";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  return (
    <AuthSplit title="Welcome!" description="Thanks for your purchase.">
      <WelcomeAfterPurchase checkoutSessionId={session_id ?? null} />
    </AuthSplit>
  );
}
