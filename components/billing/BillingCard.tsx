// components/billing/BillingCard.tsx — Settings > Billing.
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PLANS, formatPrice } from "@/convex/lib/plans";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { goTo } from "@/lib/navigate";

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function BillingCard() {
  const status = useQuery(api.billing.status, {});
  const portal = useAction(api.billing.portal);
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  // Stripe Checkout sends people back to /settings/billing?billing=success.
  useEffect(() => {
    if (params.get("billing") === "success") toast.success("Thanks for upgrading - welcome to Pro!");
  }, [params]);

  if (status === undefined) return <SettingsSection title="Plan" description="Loading…" />;

  async function openPortal() {
    setBusy(true);
    try {
      goTo((await portal({})).url);
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Couldn't open billing. Please try again.");
      setBusy(false);
    }
  }

  const plan = PLANS[status.plan];
  const trialDays = status.trialDays ?? 0;
  const proPrice = formatPrice(PLANS.pro.price[status.interval ?? "monthly"], PLANS.pro.price.currency);
  const price =
    status.plan === "pro" && status.interval
      ? `${formatPrice(PLANS.pro.price[status.interval], PLANS.pro.price.currency)} / ${status.interval === "yearly" ? "year" : "month"}`
      : status.plan === "free"
        ? `${formatPrice(0, PLANS.pro.price.currency)} / month`
        : null;

  return (
    <SettingsSection
      title="Plan"
      description="Your current plan and what it includes."
      hint={
        status.plan === "pro" && status.renewsAt && status.trialing ? (
          status.cancelAtPeriodEnd ? (
            `Your free trial ends on ${formatDate(status.renewsAt)}, and Pro ends with it. You won't be charged.`
          ) : (
            `Your free trial ends on ${formatDate(status.renewsAt)}. Your card is charged ${proPrice} then, unless you cancel before.`
          )
        ) : status.plan === "pro" && status.renewsAt ? (
          <>
            {status.cancelAtPeriodEnd ? "Your access ends on " : "Renews on "}
            {formatDate(status.renewsAt)}.
          </>
        ) : status.plan === "free" && status.billingEnabled ? (
          trialDays > 0
            ? `Try Pro free for ${trialDays} days. Cancel any time before it ends and you won't be charged.`
            : "Upgrade any time. You can cancel whenever you like."
        ) : null
      }
      footer={
        status.plan === "pro" ? (
          <Button variant="outline" disabled={busy} onClick={() => void openPortal()}>
            Manage billing
          </Button>
        ) : status.billingEnabled ? (
          <>
            {status.hasBillingAccount && (
              <Button variant="outline" disabled={busy} onClick={() => void openPortal()}>
                Billing history
              </Button>
            )}
            <Link href="/pricing" className={buttonVariants()}>
              {trialDays > 0 ? `Start ${trialDays}-day free trial` : "Upgrade to Pro"}
            </Link>
          </>
        ) : null
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{plan.name}</span>
            {status.plan === "pro" && (
              <Badge variant={status.cancelAtPeriodEnd ? "outline" : "default"}>
                {status.trialing ? "Free trial" : status.cancelAtPeriodEnd ? "Cancelling" : "Active"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {status.plan === "pro" ? (
              <>
                You&apos;re on the <strong className="text-foreground">Pro plan{status.interval ? `, billed ${status.interval}` : ""}</strong>.
              </>
            ) : status.billingEnabled ? (
              "You're on the Free plan."
            ) : (
              "You're on the Free plan. Paid plans aren't set up yet."
            )}
          </p>
        </div>
        {price && <span className="text-sm font-medium tabular-nums">{price}</span>}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
