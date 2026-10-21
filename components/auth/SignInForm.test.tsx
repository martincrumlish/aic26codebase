// components/auth/SignInForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const signIn = vi.fn((_provider: string, _data: FormData) =>
  Promise.resolve({ signingIn: true } as { signingIn: boolean }),
);
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
}));
let mode: "open" | "link" = "open";
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => mode),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { SignInForm } from "./SignInForm";

async function fillAndSubmit(password = "supersecret123") {
  await userEvent.type(screen.getByLabelText(/email/i), "user@x.com");
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("SignInForm", () => {
  beforeEach(() => {
    mode = "open";
    signIn.mockClear();
    pushMock.mockClear();
  });

  test("submits provider 'password' with flow 'signIn'", async () => {
    render(<SignInForm />);
    await fillAndSubmit();
    expect(signIn).toHaveBeenCalledWith("password", expect.any(FormData));
    const fd = signIn.mock.calls[0][1] as FormData;
    expect(fd.get("flow")).toBe("signIn");
    expect(fd.get("email")).toBe("user@x.com");
  });

  test("navigates to /dashboard after successful sign-in", async () => {
    render(<SignInForm />);
    await fillAndSubmit();
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  test("does not navigate when sign-in throws", async () => {
    signIn.mockRejectedValueOnce(new Error("bad credentials"));
    render(<SignInForm />);
    await fillAndSubmit("wrongpassword");
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("shows the server's message, even when it comes through the /api/auth route as plain text", async () => {
    signIn.mockRejectedValueOnce(
      new Error("[Request ID: abc] Server Error\nUncaught ConvexError: Invalid email or password."),
    );
    render(<SignInForm />);
    await fillAndSubmit("wrongpassword");
    expect(toast.error).toHaveBeenCalledWith("Invalid email or password.");
  });

  test("shows the code step when the account still needs to confirm its email", async () => {
    signIn.mockResolvedValueOnce({ signingIn: false });
    render(<SignInForm />);
    await fillAndSubmit();
    expect(screen.getByLabelText(/confirmation code/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("back from a Google sign-in that didn't finish: explains what to do", () => {
    render(<SignInForm googleReturn />);
    expect(screen.getByRole("status")).toHaveTextContent(/google sign-in didn't go through/i);
    expect(screen.getByRole("status")).toHaveTextContent(/sign in with your password/i);
  });

  test("links to sign-up only when sign-up is open", () => {
    const { unmount } = render(<SignInForm />);
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute("href", "/signup");
    unmount();
    mode = "link";
    render(<SignInForm />);
    expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();
  });
});
