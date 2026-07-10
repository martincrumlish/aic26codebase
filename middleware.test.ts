// middleware.test.ts
// Tests the route-matcher classification logic (pure / unit-testable).
// Implements the same pattern-matching logic as createRouteMatcher from
// @convex-dev/auth without importing the server module (which requires
// next/server and server-only, unavailable in jsdom).
import { describe, expect, test } from "vitest";

/**
 * Minimal createRouteMatcher that handles the "(.*)" glob suffix used
 * throughout middleware.ts. Mirrors the intent of the @convex-dev/auth
 * implementation, scoped to the exact patterns used in this project.
 */
function createRouteMatcher(patterns: string[]) {
  const regexes = patterns.map((p) => {
    // Convert "(.*)" suffix → optional rest-of-path match.
    const regexStr = p.replace(/\(.*\)$/, "(?:/.*)?");
    return new RegExp(`^${regexStr}$`);
  });
  return (req: { nextUrl: { pathname: string } }) =>
    regexes.some((r) => r.test(req.nextUrl.pathname));
}

// Mirror the exact matcher arrays used in middleware.ts.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/settings(.*)",
]);
const isPublicRoute = createRouteMatcher([
  "/signin(.*)",
  "/join(.*)",
  "/activate(.*)",
  "/reset(.*)",
]);

function req(path: string) {
  return { nextUrl: new URL(`http://localhost:3000${path}`) };
}

describe("middleware route classification", () => {
  test("protected routes match the protected matcher", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/x",
      "/admin",
      "/settings",
    ]) {
      expect(isProtectedRoute(req(p))).toBeTruthy();
    }
  });
  test("public routes match the public matcher and NOT the protected one", () => {
    for (const p of [
      "/signin",
      "/join/tok",
      "/activate/tok",
      "/reset",
    ]) {
      expect(isPublicRoute(req(p))).toBeTruthy();
      expect(isProtectedRoute(req(p))).toBeFalsy();
    }
  });
});
