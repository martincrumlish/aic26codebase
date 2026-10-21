// components/app-shell/AppShell.test.tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

let me: { email: string; role: "admin" | "user" } = { email: "a@x.com", role: "admin" };
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => me),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  test("on phones, the menu button opens a panel with the nav links", async () => {
    me = { email: "a@x.com", role: "admin" };
    render(<AppShell><p>content</p></AppShell>);
    await userEvent.click(screen.getByRole("button", { name: /open menu/i }));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /admin/i })).toBeInTheDocument();
  });

  test("regular users don't see the Admin link anywhere", () => {
    me = { email: "u@x.com", role: "user" };
    render(<AppShell><p>content</p></AppShell>);
    expect(screen.queryAllByRole("link", { name: /admin/i })).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
  });
});
