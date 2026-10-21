// convex/lib/authMessages.ts — the only messages sign-in and sign-up failures
// show. Each flow uses ONE message for every account-related failure, so the
// response never reveals whether an email has an account.

export const SIGNUP_REJECTED =
  "We couldn't create an account with that email. If you already have one, " +
  "sign in instead; otherwise ask your administrator for a signup link.";

export const SIGNIN_REJECTED = "Invalid email or password.";

export const PASSWORD_TOO_SHORT = "Password must be at least 8 characters.";

export const REVOKED = "This account has been revoked.";

export const CODE_INVALID = "That code is invalid or expired. Check your email or request a new one.";
