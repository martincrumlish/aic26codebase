// e2e/helpers.ts
import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

/**
 * Sign up a brand-new account and land on the dashboard. Skips the test
 * (with the reason) when this app can't do that unattended: sign-up by
 * invitation only (SIGNUP_MODE=link), or email confirmation turned on (the
 * code goes to a real inbox).
 */
export async function signUpFreshUser(page: Page) {
  const email = `e2e-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
  const password = `e2e-${randomBytes(12).toString("base64url")}`;

  await page.goto("/signup");
  const invitationOnly = page.getByText(/sign-up is by invitation/i);
  const form = page.getByLabel("Email");
  await expect(invitationOnly.or(form)).toBeVisible();
  test.skip(await invitationOnly.isVisible(), "Sign-up is by invitation (SIGNUP_MODE=link).");

  await form.fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  const codeStep = page.getByLabel(/confirmation code/i);
  await expect(codeStep.or(page.getByRole("heading", { name: /welcome back/i }))).toBeVisible();
  test.skip(await codeStep.isVisible(), "Email confirmation is on (AUTH_RESEND_KEY); the code goes to a real inbox.");

  await expect(page).toHaveURL(/\/dashboard/);
  return { email, password };
}
