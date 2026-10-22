// convex/lib/rateLimits.ts — how fast anyone can repeat the things that cost
// money or send email. Uses Convex's rate-limiter component (token buckets:
// up to `capacity` at once, refilling at `rate` per `period`).
//
// Already covered elsewhere: Convex Auth limits wrong passwords (10 an hour
// per account) and wrong emailed codes. Signup and activation links are
// random UUIDs, too long to guess. Not covered: anything per visitor IP,
// because Convex functions don't see IP addresses. For bot sign-ups, put a
// firewall or CAPTCHA in front of the site (e.g. Vercel's firewall).
//
// To change a limit, edit LIMITS. To limit something new, add an entry with
// its message and call `enforce` at the top of the function, after the access
// check (see chat.send). Tests calling a limited function need
// registerRateLimiter (vitest/rateLimiter.ts).
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";

export const LIMITS = {
  // Per user: AI messages, on any key (each one schedules a reply).
  chatMessage: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  // Per user: checking an OpenRouter key (a live call to OpenRouter).
  aiKeyCheck: { kind: "token bucket", rate: 5, period: 10 * MINUTE, capacity: 5 },
  // Per user: starting Stripe Checkout or opening the billing portal.
  checkout: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  // App-wide: signed-out checkout (there's no user to key it on).
  guestCheckout: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
  // Per email address: reset and confirmation codes. Over the limit, codes are
  // silently not sent (an error would reveal that the address has an account).
  emailCode: { kind: "token bucket", rate: 5, period: HOUR, capacity: 5 },
} as const;

type LimitName = keyof typeof LIMITS;

const MESSAGES: Record<Exclude<LimitName, "emailCode">, (wait: string) => string> = {
  chatMessage: (wait) => `You're sending messages too quickly. Try again in ${wait}.`,
  aiKeyCheck: (wait) => `Too many key checks. Try again in ${wait}.`,
  checkout: (wait) => `Too many checkout attempts. Try again in ${wait}.`,
  guestCheckout: (wait) => `Checkout is busy right now. Try again in ${wait}.`,
};

export const rateLimiter = new RateLimiter(components.rateLimiter, LIMITS);

/** "13 seconds", "2 minutes": how long to wait, rounded up. */
export function waitText(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Use up one go of `name` (for `key`), or throw a ConvexError saying how long to wait. */
export async function enforce(
  ctx: MutationCtx | ActionCtx,
  name: Exclude<LimitName, "emailCode">,
  key?: string,
): Promise<void> {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key });
  if (!ok) throw new ConvexError(MESSAGES[name](waitText(retryAfter ?? 0)));
}

/** Whether another code may be emailed to `email` now (uses up one go if so). */
export async function mayEmailCode(ctx: MutationCtx | ActionCtx, email: string): Promise<boolean> {
  const { ok } = await rateLimiter.limit(ctx, "emailCode", { key: email.trim().toLowerCase() });
  return ok;
}
