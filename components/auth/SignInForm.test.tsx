// components/auth/SignInForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const signIn = vi.fn(
  (_provider: string, _data: FormData) => Promise.resolve()
);
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

import { SignInForm } from "./SignInForm";

describe("SignInForm", () => {
  beforeEach(() => {
    signIn.mockClear();
    pushMock.mockClear();
  });

  test("submits provider 'password' with flow 'signIn'", async () => {
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@x.com");
    await userEvent.type(screen.getByLabelText(/password/i), "supersecret123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(signIn).toHaveBeenCalledWith("password", expect.any(FormData));
    const fd = signIn.mock.calls[0][1] as FormData;
    expect(fd.get("flow")).toBe("signIn");
    expect(fd.get("email")).toBe("user@x.com");
  });

  test("navigates to /dashboard after successful sign-in", async () => {
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@x.com");
    await userEvent.type(screen.getByLabelText(/password/i), "supersecret123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  test("does not navigate when sign-in throws", async () => {
    signIn.mockRejectedValueOnce(new Error("bad credentials"));
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@x.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpassword");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(pushMock).not.toHaveBeenCalled();
  });
});
