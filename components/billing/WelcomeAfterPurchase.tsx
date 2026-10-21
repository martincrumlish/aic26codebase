// components/billing/WelcomeAfterPurchase.tsx — /welcome, where Stripe sends
// a signed-out buyer after paying. Updates live once the webhook has created
// their account.
"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ActivateForm } from "@/components/auth/ActivateForm";

export function WelcomeAfterPurchase({ checkoutSessionId }: { checkoutSessionId: string | null }) {
  const welcome = useQuery(
    api.billing.welcome,
    checkoutSessionId ? { checkoutSessionId } : "skip",
  );

  if (!checkoutSessionId) {
    return (
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t find your purchase. If you&apos;ve just paid, check your email for your
        activation link.
      </p>
    );
  }
  if (welcome === undefined || welcome.status === "processing") {
    return (
      <p className="text-sm text-muted-foreground">
        Payment received! Setting up your account… this takes a few seconds.
      </p>
    );
  }
  if (welcome.status === "activate" && welcome.activationToken) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Payment received! Set a password to start using Pro.</p>
        <ActivateForm token={welcome.activationToken} />
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Payment received. This email already has an account, so Pro has been added to it.{" "}
      <Link href="/signin" className="underline">Sign in</Link> to use it.
    </p>
  );
}
