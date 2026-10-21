// components/settings/AiForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

let status: { enabled: boolean; source?: "own" | "app"; last4?: string; appKeyNeedsPro?: boolean } | undefined;
let usage: { source: "own" | "app" | null; used: number; limit: number | null; resetsAt: number | null } | undefined;
const setOpenRouterKey = vi.fn(() => Promise.resolve({ last4: "abcd" }));
const clearOpenRouterKey = vi.fn(() => Promise.resolve(null));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useQuery: vi.fn((ref: any) => (getFunctionName(ref) === "ai:usage" ? usage : status)),
  useAction: vi.fn(() => setOpenRouterKey),
  useMutation: vi.fn(() => clearOpenRouterKey),
}));

import { AiForm } from "./AiForm";

beforeEach(() => {
  usage = { source: null, used: 0, limit: null, resetsAt: null };
  setOpenRouterKey.mockClear();
  clearOpenRouterKey.mockClear();
});

describe("AiForm", () => {
  test("on the app's key: shows this month's messages against the allowance", () => {
    status = { enabled: true, source: "app" };
    usage = { source: "app", used: 230, limit: 1000, resetsAt: Date.parse("2026-11-01T00:00:00Z") };
    render(<AiForm />);
    expect(screen.getByText(/230 of 1,000 AI messages used this month/i)).toBeInTheDocument();
    expect(screen.getByText(/resets november 1/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /ai messages used/i })).toHaveAttribute("aria-valuenow", "230");
  });

  test("on your own key: no allowance shown (it's unlimited)", () => {
    status = { enabled: true, source: "own", last4: "abcd" };
    usage = { source: "own", used: 0, limit: null, resetsAt: null };
    render(<AiForm />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

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

  test("on Free, explains the built-in AI comes with Pro and links to pricing", () => {
    status = { enabled: false, appKeyNeedsPro: true };
    render(<AiForm />);
    expect(screen.getByText(/built-in ai is included with pro/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade/i })).toHaveAttribute("href", "/pricing");
  });

  test("shows the app-provided key status without a Remove button", () => {
    status = { enabled: true, source: "app" };
    render(<AiForm />);
    expect(screen.getByText(/app's built-in key/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });
});
