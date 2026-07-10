// components/auth/SignOutButton.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const signOut = vi.fn(() => Promise.resolve());
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut }),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

import { SignOutButton } from "./SignOutButton";

describe("SignOutButton", () => {
  beforeEach(() => {
    signOut.mockClear();
    pushMock.mockClear();
  });

  test("calls signOut on click", async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  test("navigates to /signin after signOut resolves", async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    // wait for the promise to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(pushMock).toHaveBeenCalledWith("/signin");
  });
});
