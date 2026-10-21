// components/landing/Landing.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { siteConfig } from "@/lib/site";
import { Landing } from "./Landing";

describe("Landing", () => {
  test("shows the app name and description from siteConfig, and a sign-in link", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1, name: siteConfig.name })).toBeInTheDocument();
    expect(screen.getByText(siteConfig.description)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/signin");
  });
});
