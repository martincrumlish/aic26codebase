// components/landing/Landing.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { siteConfig } from "@/lib/site";
import { Landing } from "./Landing";

describe("Landing", () => {
  test("shows the app name and description from siteConfig, and a sign-in link", () => {
    render(<Landing signupOpen={false} />);
    expect(screen.getByRole("heading", { level: 1, name: siteConfig.name })).toBeInTheDocument();
    expect(screen.getByText(siteConfig.description)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/signin");
    expect(screen.queryByRole("link", { name: /get started/i })).not.toBeInTheDocument();
  });

  test("when sign-up is open, also offers Get started", () => {
    render(<Landing signupOpen />);
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/signup");
  });
});
