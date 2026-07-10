// components/auth/JoinForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

const signIn = vi.fn((_provider: string, _data: FormData) => Promise.resolve());
const useQueryMock = vi.fn();

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
}));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: (...a: unknown[]) => useQueryMock(...a),
}));

import { JoinForm } from "./JoinForm";

describe("JoinForm", () => {
  test("shows the rejection reason for an invalid token", () => {
    useQueryMock.mockReturnValue({ valid: false, reason: "This link has expired." });
    render(<JoinForm token="tok" />);
    expect(screen.getByText(/this link has expired/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  test("valid token: submits password signUp with the token in the form data", async () => {
    useQueryMock.mockReturnValue({ valid: true, purpose: "signup", targetRole: "creator" });
    render(<JoinForm token="tok_123" />);
    await userEvent.type(screen.getByLabelText(/email/i), "new@x.com");
    await userEvent.type(screen.getByLabelText(/^password/i), "supersecret123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(signIn).toHaveBeenCalledWith("password", expect.any(FormData));
    const fd = signIn.mock.calls[0]![1];
    expect(fd.get("flow")).toBe("signUp");
    expect(fd.get("token")).toBe("tok_123");
    expect(fd.get("email")).toBe("new@x.com");
  });
});
