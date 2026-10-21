// components/app-shell/AccountMenu.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

const setTheme = vi.fn();
let resolvedTheme = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const signOut = vi.fn(() => Promise.resolve());
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut }),
}));
const goTo = vi.fn();
vi.mock("@/lib/navigate", () => ({ goTo: (url: string) => goTo(url) }));

import { AccountMenu } from "./AccountMenu";

describe("AccountMenu sign out", () => {
  test("signs out, then loads the sign-in page fresh (no state from the old session)", async () => {
    render(<AccountMenu email="a@x.com" />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
    expect(goTo).toHaveBeenCalledWith("/signin");
  });
});

describe("AccountMenu theme toggle", () => {
  test("in light mode, offers dark mode", async () => {
    resolvedTheme = "light";
    setTheme.mockClear();
    render(<AccountMenu email="a@x.com" />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /dark mode/i }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  test("in dark mode, offers light mode", async () => {
    resolvedTheme = "dark";
    setTheme.mockClear();
    render(<AccountMenu email="a@x.com" />);
    await userEvent.click(screen.getByRole("button", { name: /account menu/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /light mode/i }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });
});
