// components/billing/BillingCard.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

let status: Record<string, unknown> | undefined;
const portal = vi.fn(() => Promise.resolve({ url: "https://stripe.test/portal" }));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => status),
  useAction: vi.fn(() => portal),
}));
const goTo = vi.fn();
vi.mock("@/lib/navigate", () => ({ goTo: (url: string) => goTo(url) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { BillingCard } from "./BillingCard";

const renewsAt = new Date("2030-03-15T12:00:00Z").getTime();

beforeEach(() => {
  portal.mockClear();
  goTo.mockClear();
});

describe("BillingCard", () => {
  test("Free: says so and links to the pricing page to upgrade", () => {
    status = { plan: "free", billingEnabled: true, hasBillingAccount: false };
    render(<BillingCard />);
    expect(screen.getByText(/you're on the free plan/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade/i })).toHaveAttribute("href", "/pricing");
  });

  test("Pro, renewing: shows the renewal date; Manage billing opens Stripe's portal", async () => {
    status = {
      plan: "pro", billingEnabled: true, hasBillingAccount: true,
      interval: "yearly", renewsAt, cancelAtPeriodEnd: false,
    };
    render(<BillingCard />);
    expect(screen.getByText(/pro plan, billed yearly/i)).toBeInTheDocument();
    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /manage billing/i }));
    expect(portal).toHaveBeenCalled();
    expect(goTo).toHaveBeenCalledWith("https://stripe.test/portal");
  });

  test("Pro, cancelling: says when access ends", () => {
    status = {
      plan: "pro", billingEnabled: true, hasBillingAccount: true,
      interval: "monthly", renewsAt, cancelAtPeriodEnd: true,
    };
    render(<BillingCard />);
    expect(screen.getByText(/ends on/i)).toBeInTheDocument();
  });

  test("billing not set up: explains instead of offering an upgrade", () => {
    status = { plan: "free", billingEnabled: false, hasBillingAccount: false };
    render(<BillingCard />);
    expect(screen.getByText(/aren't set up yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /upgrade/i })).not.toBeInTheDocument();
  });
});
