// components/billing/WelcomeAfterPurchase.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

let welcome: { status: string; activationToken?: string } | undefined;
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => welcome),
}));
vi.mock("@/components/auth/ActivateForm", () => ({
  ActivateForm: ({ token }: { token: string }) => <p>activate-form:{token}</p>,
}));

import { WelcomeAfterPurchase } from "./WelcomeAfterPurchase";

describe("WelcomeAfterPurchase", () => {
  test("while the webhook hasn't arrived, says the account is being set up", () => {
    welcome = { status: "processing" };
    render(<WelcomeAfterPurchase checkoutSessionId="cs_1" />);
    expect(screen.getByText(/setting up your account/i)).toBeInTheDocument();
  });

  test("a new account: shows the activation form for its token", () => {
    welcome = { status: "activate", activationToken: "act_9" };
    render(<WelcomeAfterPurchase checkoutSessionId="cs_1" />);
    expect(screen.getByText("activate-form:act_9")).toBeInTheDocument();
  });

  test("an existing account: asks them to sign in", () => {
    welcome = { status: "signin" };
    render(<WelcomeAfterPurchase checkoutSessionId="cs_1" />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/signin");
  });

  test("no session id in the URL: explains rather than spinning forever", () => {
    welcome = undefined;
    render(<WelcomeAfterPurchase checkoutSessionId={null} />);
    expect(screen.getByText(/couldn't find your purchase/i)).toBeInTheDocument();
  });
});
