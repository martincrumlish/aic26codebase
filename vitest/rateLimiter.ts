// vitest/rateLimiter.ts — register the @convex-dev/rate-limiter component with
// convex-test. Any test that calls a rate-limited function needs this (see
// convex/lib/rateLimits.ts for which ones are).
import type { TestConvex } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerRateLimiter(t: TestConvex<any>) {
  rateLimiter.register(t);
}
