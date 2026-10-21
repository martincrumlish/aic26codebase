// e2e/app.spec.ts — the main signed-in journeys, in a real browser against a
// real backend. Each test signs up its own fresh account.
import { expect, test } from "@playwright/test";
import { signUpFreshUser } from "./helpers";

test("sign up, then create, edit and delete a project", async ({ page }) => {
  await signUpFreshUser(page);

  await page.getByRole("link", { name: "Projects" }).first().click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill("Launch checklist");
  await page.getByLabel("Description (optional)").fill("Everything for launch day.");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByRole("link", { name: /launch checklist/i }).click();
  await expect(page.getByRole("heading", { name: "Launch checklist" })).toBeVisible();
  await page.getByLabel("Name").fill("Launch checklist v2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Launch checklist v2" })).toBeVisible();

  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByRole("button", { name: "Delete forever" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText(/no projects yet/i)).toBeVisible();
});

test("changing your name in Settings shows on the dashboard", async ({ page }) => {
  await signUpFreshUser(page);
  await page.goto("/settings/profile");
  await page.getByLabel("Name").fill("Rhea Okafor");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome back, Rhea" })).toBeVisible();
});

test("the AI chat page is ready, or explains how to turn AI on", async ({ page }) => {
  await signUpFreshUser(page);
  await page.goto("/chat");
  await expect(page.getByLabel("Message").or(page.getByRole("link", { name: "Add your key" }))).toBeVisible();
});

test("Upgrade to Pro hands off to Stripe Checkout", async ({ page }) => {
  await signUpFreshUser(page);
  await page.goto("/pricing");
  const upgrade = page.getByRole("button", { name: "Upgrade to Pro" });
  const notSetUp = page.getByText(/payments aren't set up yet/i);
  await expect(upgrade.or(notSetUp).first()).toBeVisible();
  test.skip(await notSetUp.isVisible(), "Stripe isn't set up on this deployment (npm run setup:stripe).");

  await upgrade.click();
  // We stop at Stripe's page: paying is Stripe's job, and the webhook side is
  // covered by convex/billing.test.ts.
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
});

test("signing out locks the app again", async ({ page }) => {
  await signUpFreshUser(page);
  await page.getByRole("button", { name: "Account menu" }).first().click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/signin/);
});
