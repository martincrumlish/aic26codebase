// components/auth/ActivateForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

const signIn = vi.fn((_provider: string, _data: FormData) => Promise.resolve());
const useMutationMock = vi.fn();
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
}));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => ({ valid: true, purpose: "activation", email: "owner@x.com" })),
  useMutation: (...a: unknown[]) => useMutationMock(...a),
}));

import { ActivateForm } from "./ActivateForm";

describe("ActivateForm", () => {
  test("activates by signing up with the activation token itself (no separate pre-claim step)", async () => {
    render(<ActivateForm token="act_123" />);
    await userEvent.type(screen.getByLabelText(/^password/i), "owner-pass-123");
    await userEvent.click(screen.getByRole("button", { name: /activate account/i }));

    expect(signIn).toHaveBeenCalledWith("password", expect.any(FormData));
    const fd = signIn.mock.calls[0]![1];
    expect(fd.get("flow")).toBe("signUp");
    expect(fd.get("token")).toBe("act_123");
    expect(fd.get("email")).toBe("owner@x.com");
    expect(useMutationMock).not.toHaveBeenCalled();
  });

  test("when email confirmation is needed, shows the code step", async () => {
    signIn.mockResolvedValueOnce({ signingIn: false } as never);
    render(<ActivateForm token="act_123" />);
    await userEvent.type(screen.getByLabelText(/^password/i), "owner-pass-123");
    await userEvent.click(screen.getByRole("button", { name: /activate account/i }));
    expect(screen.getByLabelText(/confirmation code/i)).toBeInTheDocument();
  });

  test("the email from the link is shown but can't be changed", () => {
    render(<ActivateForm token="act_123" />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("readonly");
  });
});
