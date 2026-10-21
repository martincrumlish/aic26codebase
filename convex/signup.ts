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
