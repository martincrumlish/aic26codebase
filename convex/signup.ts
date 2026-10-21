// convex/signup.ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import { signupMode } from "./lib/signupMode";

/**
 * Public on purpose (signed-out pages use it to show or hide "Sign up").
 * Reveals only the app's sign-up setting, nothing about users.
 */
export const mode = query({
  args: {},
  returns: v.union(v.literal("open"), v.literal("link")),
  handler: async () => signupMode(),
});

/**
 * Public on purpose (signed-out pages show "Continue with Google" only when
 * it's set up). Reveals only whether the two env vars are set.
 */
export const googleEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async () => Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
});
