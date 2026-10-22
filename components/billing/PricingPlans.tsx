// components/billing/PricingPlans.tsx — plan cards for /pricing. Plans,
// prices and features come from convex/lib/plans.ts.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PLANS, formatPrice, type BillingInterval } from "@/convex/lib/plans";
import { Button, buttonVariants } from "@/components/ui/button";
import { goTo } from "@/lib/navigate";
import { cn } from "@/lib/utils";

const pro = PLANS.pro;
const yearlySaving = pro.price.monthly * 12 - pro.price.yearly;

export function PricingPlans() {
  const { isAuthenticated } = useConvexAuth();
  const enabled = useQuery(api.billing.enabled, {});
  const mode = useQuery(api.signup.mode, {});
  const status = useQuery(api.billing.status, isAuthenticated ? {} : "skip");
  const checkout = useAction(api.billing.checkout);
  const guestCheckout = useAction(api.billing.guestCheckout);
  const portal = useAction(api.billing.portal);
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [busy, setBusy] = useState(false);

  const plan = status?.plan;
  // Signed out we can't know whether they've had a trial, so offer it (the
  // server decides at checkout for signed-in people; see billing.ts).
  const trialDays = isAuthenticated ? (status?.trialDays ?? 0) : pro.trialDays;
  const buyLabel = trialDays > 0 ? `Start ${trialDays}-day free trial` : null;
  const per = interval === "monthly" ? "month" : "year";
  const buying = !isAuthenticated || plan === "free";

  async function redirectTo(start: () => Promise<{ url: string }>) {
    setBusy(true);
    try {
      const { url } = await start();
      goTo(url);
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div
          className="inline-flex rounded-full border border-sidebar-foreground/15 bg-sidebar-foreground/5 p-1"
          role="group"
          aria-label="Billing period"
        >
          {(["monthly", "yearly"] as const).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interval === i}
              onClick={() => setBillingInterval(i)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                interval === i ? "bg-sidebar-foreground text-sidebar shadow-sm" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
              )}
            >
              {i === "monthly" ? "Monthly" : "Yearly"}
              {i === "yearly" && yearlySaving > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-xs",
                    interval === i ? "bg-emerald-600/10 text-emerald-700" : "bg-emerald-400/15 text-emerald-300",
                  )}
                >
                  save {formatPrice(yearlySaving, pro.price.currency)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-stretch gap-6 md:grid-cols-2">
        <PlanCard
          name={PLANS.free.name}
          description={PLANS.free.description}
          price={formatPrice(0, pro.price.currency)}
          per={interval === "monthly" ? "/month" : "/year"}
          features={PLANS.free.features}
        >
          {!isAuthenticated && mode === "open" && (
            <Link href="/signup" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
              Get started
            </Link>
          )}
          {plan === "free" && <p className="text-center text-sm text-muted-foreground">Your current plan</p>}
        </PlanCard>

        <PlanCard
          highlighted
          name={pro.name}
          description={pro.description}
          price={formatPrice(pro.price[interval], pro.price.currency)}
          per={interval === "monthly" ? "/month" : "/year"}
          features={pro.features}
        >
          {!isAuthenticated && (
            <Button
              size="lg"
              className="w-full"
              disabled={!enabled || busy}
              onClick={() => void redirectTo(() => guestCheckout({ interval }))}
            >
              {buyLabel ?? "Buy Pro"}
            </Button>
          )}
          {plan === "free" && (
            <Button
              size="lg"
              className="w-full"
              disabled={!enabled || busy}
              onClick={() => void redirectTo(() => checkout({ interval }))}
            >
              {buyLabel ?? "Upgrade to Pro"}
            </Button>
          )}
          {buying && (trialDays > 0 || pro.promotionCodes) && (
            <p className="text-center text-xs text-muted-foreground">
              {trialDays > 0 &&
                `Then ${formatPrice(pro.price[interval], pro.price.currency)}/${per}. Cancel before the trial ends and you won't be charged. `}
              {pro.promotionCodes && "Have a promotion code? Enter it at checkout."}
            </p>
          )}
          {plan === "pro" && (
            <>
              <p className="text-center text-sm text-muted-foreground">Your current plan</p>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void redirectTo(() => portal({}))}
              >
                Manage billing
              </Button>
            </>
          )}
          {enabled === false && (
            <p className="text-center text-xs text-muted-foreground">Payments aren&apos;t set up yet.</p>
          )}
        </PlanCard>
      </div>
    </div>
  );
}

function PlanCard(props: {
  name: string;
  description: string;
  price: string;
  per: string;
  features: readonly string[];
  highlighted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-7 text-card-foreground shadow-xl shadow-black/20",
        props.highlighted && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{props.name}</h2>
        {props.highlighted && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Recommended</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
      <p className="mt-5 flex items-baseline gap-1">
        <span className="text-5xl font-semibold tracking-tight">{props.price}</span>
        <span className="text-sm text-muted-foreground">{props.per}</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5 border-t pt-6 text-sm">
        {props.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-8 space-y-2">{props.children}</div>
    </section>
  );
}
