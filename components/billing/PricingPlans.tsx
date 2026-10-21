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
        <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Billing period">
          {(["monthly", "yearly"] as const).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interval === i}
              onClick={() => setBillingInterval(i)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                interval === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i === "monthly" ? "Monthly" : "Yearly"}
              {i === "yearly" && yearlySaving > 0 && (
                <span className="ml-1.5 text-xs opacity-80">save {formatPrice(yearlySaving, pro.price.currency)}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PlanCard
          name={PLANS.free.name}
          description={PLANS.free.description}
          price={formatPrice(0, pro.price.currency)}
          per={interval === "monthly" ? "/month" : "/year"}
          features={PLANS.free.features}
        >
          {!isAuthenticated && mode === "open" && (
            <Link href="/signup" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
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
              className="w-full"
              disabled={!enabled || busy}
              onClick={() => void redirectTo(() => guestCheckout({ interval }))}
            >
              Buy Pro
            </Button>
          )}
          {plan === "free" && (
            <Button
              className="w-full"
              disabled={!enabled || busy}
              onClick={() => void redirectTo(() => checkout({ interval }))}
            >
              Upgrade to Pro
            </Button>
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
        "flex flex-col rounded-xl border bg-card p-6 text-card-foreground",
        props.highlighted && "border-primary shadow-sm",
      )}
    >
      <h2 className="text-lg font-semibold">{props.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
      <p className="mt-4">
        <span className="text-4xl font-semibold tracking-tight">{props.price}</span>
        <span className="text-sm text-muted-foreground">{props.per}</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {props.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6 space-y-2">{props.children}</div>
    </section>
  );
}
