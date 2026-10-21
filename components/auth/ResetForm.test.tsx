// components/auth/ResetForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";

const signIn = vi.fn((_provider: string, _data: FormData): Promise<unknown> => Promise.resolve());
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ResetForm } from "./ResetForm";

beforeEach(() => {
  signIn.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

async function requestCode(email: string) {
  render(<ResetForm />);
  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.click(screen.getByRole("button", { name: /send reset code/i }));
}

describe("ResetForm", () => {
  test("requests a code with the reset flow and moves to the code step", async () => {
    signIn.mockResolvedValueOnce(undefined);
    await requestCode("a@x.com");
    const fd = signIn.mock.calls[0]![1];
    expect(fd.get("flow")).toBe("reset");
    expect(fd.get("email")).toBe("a@x.com");
    expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
  });

  test("an unknown email looks exactly like success (no account enumeration)", async () => {
    signIn.mockRejectedValueOnce(new Error("InvalidAccountId"));
    await requestCode("nobody@x.com");
    expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/if that address has an account/i));
  });

  test("a server-explained failure (e.g. email not set up) is shown and stays on the request step", async () => {
    signIn.mockRejectedValueOnce(new ConvexError("Password reset needs email, and email isn't set up."));
    await requestCode("a@x.com");
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/email isn't set up/i));
    expect(screen.queryByLabelText(/reset code/i)).not.toBeInTheDocument();
  });

  test("submits the code and new password with the reset-verification flow", async () => {
    signIn.mockResolvedValueOnce(undefined);
    await requestCode("a@x.com");
    signIn.mockResolvedValueOnce(undefined);
    await userEvent.type(screen.getByLabelText(/reset code/i), "12345678");
    await userEvent.type(screen.getByLabelText(/new password/i), "brand-new-password");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    const fd = signIn.mock.calls[1]![1];
    expect(fd.get("flow")).toBe("reset-verification");
    expect(fd.get("email")).toBe("a@x.com");
    expect(fd.get("code")).toBe("12345678");
    expect(fd.get("newPassword")).toBe("brand-new-password");
  });
});
