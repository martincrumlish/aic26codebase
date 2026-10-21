// components/settings/SettingsNav.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

let pathname = "/settings/billing";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { SettingsNav } from "./SettingsNav";

describe("SettingsNav", () => {
  test("links to each section and marks the current one", () => {
    render(<SettingsNav />);
    const hrefs = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(hrefs).toEqual([
      ["Profile", "/settings/profile"],
      ["Billing", "/settings/billing"],
      ["Sign-in & security", "/settings/security"],
      ["AI", "/settings/ai"],
    ]);
    expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Profile" })).not.toHaveAttribute("aria-current");
  });
});
