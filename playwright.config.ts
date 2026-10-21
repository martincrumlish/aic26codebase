// playwright.config.ts — end-to-end tests in a real browser (e2e/).
//
//   npm run test:e2e                                  # against http://localhost:3000
//   E2E_BASE_URL=https://staging.example.com npm run test:e2e
//
// Locally, an already-running `npm run dev` is reused (or one is started).
// The tests create real accounts and projects, so point them at a dev or
// staging deployment, never production.
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const local = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: local
    ? { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 }
    : undefined,
});
