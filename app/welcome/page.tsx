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
    <AuthSplit>
      <h1 className="text-center text-2xl font-semibold">Welcome!</h1>
      <WelcomeAfterPurchase checkoutSessionId={session_id ?? null} />
    </AuthSplit>
  );
}
