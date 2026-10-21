// components/auth/EmailCodeStep.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

const signIn = vi.fn((_provider: string, _data: FormData) => Promise.resolve({ signingIn: true }));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
}));

import { EmailCodeStep } from "./EmailCodeStep";

describe("EmailCodeStep", () => {
  test("submits the code with the email-verification flow, then calls onDone", async () => {
    const onDone = vi.fn();
    render(<EmailCodeStep email="new@x.com" onDone={onDone} />);
    expect(screen.getByText(/new@x\.com/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/confirmation code/i), "12345678");
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));

    const fd = signIn.mock.calls[0]![1];
    expect(fd.get("flow")).toBe("email-verification");
    expect(fd.get("email")).toBe("new@x.com");
    expect(fd.get("code")).toBe("12345678");
    expect(onDone).toHaveBeenCalled();
  });
});
