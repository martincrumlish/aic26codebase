// e2e/public.spec.ts — the signed-out pages load and link together.
import { expect, test } from "@playwright/test";

test("landing page shows the app and links to pricing and sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: /preview of the app/i })).toBeVisible();

  await page.getByRole("link", { name: "Pricing" }).click();
  await expect(page).toHaveURL(/\/pricing/);
  await expect(page.getByRole("heading", { name: "Free" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();

  await page.getByRole("link", { name: "Sign in" }).first().click();
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("signed-out visitors can't open the app", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/signin/);
});

test("a wrong password gets the same message as an unknown email", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});
