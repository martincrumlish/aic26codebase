// middleware.ts
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Authed-only areas.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/settings(.*)",
]);

// Public (no auth required).
const isPublicRoute = createRouteMatcher([
  "/signin(.*)",
  "/join(.*)",
  "/activate(.*)",
  "/reset(.*)",
]);

const isSignInPage = createRouteMatcher(["/signin(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated();

  // Signed in but on /signin → dashboard.
  if (isSignInPage(request) && authed) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
  // Protected area, not signed in → /signin.
  if (isProtectedRoute(request) && !authed) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
  // Public routes (and "/") fall through.
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};

// isPublicRoute is defined here for symmetry — referenced in middleware.test.ts.
export { isPublicRoute };
