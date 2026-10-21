// components/billing/BillingCard.tsx — the Billing section of Settings.
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { goTo } from "@/lib/navigate";

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function BillingCard() {
  const status = useQuery(api.billing.status, {});
  const portal = useAction(api.billing.portal);
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  // Stripe Checkout sends people back to /settings?billing=success.
  useEffect(() => {
    if (params.get("billing") === "success") toast.success("Thanks for upgrading - welcome to Pro!");
  }, [params]);

  if (status === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function openPortal() {
    setBusy(true);
    try {
      goTo((await portal({})).url);
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Couldn't open billing. Please try again.");
      setBusy(false);
    }
  }

  if (status.plan === "pro") {
    return (
      <div className="max-w-sm space-y-4">
        <p className="text-sm">
          You&apos;re on the <strong>Pro plan{status.interval ? `, billed ${status.interval}` : ""}</strong>.
        </p>
        {status.renewsAt && (
          <p className="text-sm text-muted-foreground">
            {status.cancelAtPeriodEnd ? "Your access ends on " : "Renews on "}
            {formatDate(status.renewsAt)}.
          </p>
        )}
        <Button variant="outline" disabled={busy} onClick={() => void openPortal()}>
          Manage billing
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-sm space-y-4">
      <p className="text-sm">
        {status.billingEnabled
          ? "You're on the Free plan."
          : "You're on the Free plan. Paid plans aren't set up yet."}
      </p>
      {status.billingEnabled && (
        <div className="flex flex-wrap gap-2">
          <Link href="/pricing" className={buttonVariants()}>
            Upgrade to Pro
          </Link>
          {status.hasBillingAccount && (
            <Button variant="outline" disabled={busy} onClick={() => void openPortal()}>
              Billing history
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
