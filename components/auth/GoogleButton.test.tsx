// components/auth/GoogleButton.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const signIn = vi.fn((_provider: string, _opts?: unknown) => Promise.resolve({ signingIn: false }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn, signOut: vi.fn() }) }));
let enabled: boolean | undefined = true;
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => enabled),
}));

import { GoogleButton } from "./GoogleButton";

beforeEach(() => {
  enabled = true;
  signIn.mockClear();
});

describe("GoogleButton", () => {
  test("starts Google sign-in, coming back to /signin?via=google", async () => {
    render(<GoogleButton />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/signin?via=google" });
  });

  test("hidden until Google is set up (and while loading)", () => {
    enabled = false;
    const { container, rerender } = render(<GoogleButton />);
    expect(container).toBeEmptyDOMElement();
    enabled = undefined;
    rerender(<GoogleButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
