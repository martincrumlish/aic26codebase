// components/billing/PricingPlans.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

let state: {
  auth: boolean;
  enabled: boolean;
  mode: "open" | "link";
  status?: { plan: "free" | "pro"; billingEnabled: boolean; hasBillingAccount: boolean; trialDays: number };
};
const actions: Record<string, ReturnType<typeof vi.fn>> = {};
const actionFor = (name: string) =>
  (actions[name] ??= vi.fn(() => Promise.resolve({ url: `https://stripe.test/${name}` })));

vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useConvexAuth: () => ({ isAuthenticated: state.auth, isLoading: false }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useQuery: vi.fn((ref: any, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    if (name === "billing:enabled") return state.enabled;
    if (name === "signup:mode") return state.mode;
    if (name === "billing:status") return state.status;
    return undefined;
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAction: vi.fn((ref: any) => actionFor(getFunctionName(ref))),
}));
const goTo = vi.fn();
vi.mock("@/lib/navigate", () => ({ goTo: (url: string) => goTo(url) }));

import { PricingPlans } from "./PricingPlans";

beforeEach(() => {
  state = { auth: false, enabled: true, mode: "open" };
  Object.values(actions).forEach((a) => a.mockClear());
  goTo.mockClear();
});

describe("PricingPlans", () => {
  test("shows both plans with Pro's monthly price, and yearly after toggling", async () => {
    render(<PricingPlans />);
    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pro" })).toBeInTheDocument();
    expect(screen.getByText("$12")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText("$120")).toBeInTheDocument();
  });

  test("signed out: Free offers Get started; Pro starts a guest checkout (with the free trial) for the chosen interval", async () => {
    render(<PricingPlans />);
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/signup");
    await userEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText(/then \$120\/year/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /start 14-day free trial/i }));
    expect(actions["billing:guestCheckout"]).toHaveBeenCalledWith({ interval: "yearly" });
    expect(goTo).toHaveBeenCalledWith("https://stripe.test/billing:guestCheckout");
  });

  test("signed in on Free, never subscribed: offers the free trial, then the price, and promotion codes", async () => {
    state.auth = true;
    state.status = { plan: "free", billingEnabled: true, hasBillingAccount: false, trialDays: 14 };
    render(<PricingPlans />);
    expect(screen.getByText(/then \$12\/month/i)).toBeInTheDocument();
    expect(screen.getByText(/promotion code/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /start 14-day free trial/i }));
    expect(actions["billing:checkout"]).toHaveBeenCalledWith({ interval: "monthly" });
  });

  test("signed in on Free, trial used before: Upgrade starts a checkout", async () => {
    state.auth = true;
    state.status = { plan: "free", billingEnabled: true, hasBillingAccount: true, trialDays: 0 };
    render(<PricingPlans />);
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /upgrade/i }));
    expect(actions["billing:checkout"]).toHaveBeenCalledWith({ interval: "monthly" });
    expect(goTo).toHaveBeenCalledWith("https://stripe.test/billing:checkout");
  });

  test("signed in on Pro: shows the current plan and Manage billing opens the portal", async () => {
    state.auth = true;
    state.status = { plan: "pro", billingEnabled: true, hasBillingAccount: true, trialDays: 0 };
    render(<PricingPlans />);
    expect(screen.getAllByText(/your current plan/i).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /manage billing/i }));
    expect(actions["billing:portal"]).toHaveBeenCalled();
  });

  test("when billing isn't set up, Pro can't be bought and says why", () => {
    state.enabled = false;
    render(<PricingPlans />);
    expect(screen.getByRole("button", { name: /free trial/i })).toBeDisabled();
    expect(screen.getByText(/payments aren't set up yet/i)).toBeInTheDocument();
  });

  test("link-only mode hides Get started for signed-out visitors", () => {
    state.mode = "link";
    render(<PricingPlans />);
    expect(screen.queryByRole("link", { name: /get started/i })).not.toBeInTheDocument();
  });
});
