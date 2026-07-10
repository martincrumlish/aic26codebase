// components/settings/AiForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

let status: { enabled: boolean; source?: "own" | "app"; last4?: string } | undefined;
const setOpenRouterKey = vi.fn(() => Promise.resolve({ last4: "abcd" }));
const clearOpenRouterKey = vi.fn(() => Promise.resolve(null));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => status),
  useAction: vi.fn(() => setOpenRouterKey),
  useMutation: vi.fn(() => clearOpenRouterKey),
}));

import { AiForm } from "./AiForm";

beforeEach(() => {
  setOpenRouterKey.mockClear();
  clearOpenRouterKey.mockClear();
});

describe("AiForm", () => {
  test("saves and verifies a pasted key", async () => {
    status = { enabled: false };
    render(<AiForm />);
    const input = screen.getByLabelText(/openrouter api key/i);
    expect(input).toHaveAttribute("type", "password");
    await userEvent.type(input, "sk-or-v1-test-abcd");
    await userEvent.click(screen.getByRole("button", { name: /save & verify/i }));
    expect(setOpenRouterKey).toHaveBeenCalledWith({ key: "sk-or-v1-test-abcd" });
  });

  test("shows AI disabled when no key is available", () => {
    status = { enabled: false };
    render(<AiForm />);
    expect(screen.getByText(/ai features are disabled/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  test("shows the user's own key by last4 with a Remove button", async () => {
    status = { enabled: true, source: "own", last4: "abcd" };
    render(<AiForm />);
    expect(
      screen.getByText((_, el) => /your key ending in .*abcd/i.test(el?.textContent ?? "") && el?.tagName === "P"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(clearOpenRouterKey).toHaveBeenCalledWith({});
  });

  test("shows the app-provided key status without a Remove button", () => {
    status = { enabled: true, source: "app" };
    render(<AiForm />);
    expect(screen.getByText(/app's built-in key/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });
});
