// components/auth/SignUpForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const signIn = vi.fn((_provider: string, _data: FormData) =>
  Promise.resolve({ signingIn: true } as { signingIn: boolean }),
);
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
}));
let mode: "open" | "link" | undefined = "open";
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => mode),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

import { SignUpForm } from "./SignUpForm";

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText(/email/i), "new@x.com");
  await userEvent.type(screen.getByLabelText(/^password/i), "new-person-pw-1");
  await userEvent.click(screen.getByRole("button", { name: /create account/i }));
}

beforeEach(() => {
  mode = "open";
  signIn.mockClear();
  push.mockClear();
});

describe("SignUpForm", () => {
  test("open mode: signs up with the signUp flow and goes to the dashboard", async () => {
    render(<SignUpForm />);
    await fillAndSubmit();
    const fd = signIn.mock.calls[0]![1];
    expect(fd.get("flow")).toBe("signUp");
    expect(fd.get("email")).toBe("new@x.com");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  test("when email confirmation is needed, shows the code step instead of leaving", async () => {
    signIn.mockResolvedValueOnce({ signingIn: false });
    render(<SignUpForm />);
    await fillAndSubmit();
    expect(screen.getByLabelText(/confirmation code/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  test("link-only mode: explains sign-up is by invitation and shows no form", () => {
    mode = "link";
    render(<SignUpForm />);
    expect(screen.getByText(/signup link/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });
});
