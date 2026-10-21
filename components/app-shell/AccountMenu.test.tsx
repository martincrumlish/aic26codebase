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
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));

import { AccountMenu } from "./AccountMenu";

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
