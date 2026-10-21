// convex/lib/signupMode.ts — who may create an account.
//   "open" (default): anyone can sign up with an email and password.
//   "link": only people with a signup link (or an account created for them).
// Set with `npx convex env set SIGNUP_MODE link`.

export type SignupMode = "open" | "link";

export function signupMode(): SignupMode {
  return process.env.SIGNUP_MODE === "link" ? "link" : "open";
}
