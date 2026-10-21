// convex/passwordReset.ts — "Forgot your password?": the Password provider's
// reset flow emails an 8-digit code via Resend (see lib/emailCode.ts). The
// reset page checks `available` first and explains a missing email setup
// before asking for anything.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { emailCodeProvider, generateCode, sendCode } from "./lib/emailCode";

const RESET_EMAIL = {
  subject: "Your password reset code",
  intro: "Use this code to reset your password:",
  ignoreIf: "ask to reset your password",
};

/**
 * Public on purpose (no sign-in needed: it's for the "Forgot your password?"
 * page). Reveals only whether email is configured, not anything about users.
 */
export const available = query({
  args: {},
  returns: v.boolean(),
  handler: async () => !!process.env.AUTH_RESEND_KEY,
});

export const generateResetCode = generateCode;

export function sendResetCode(email: string, code: string): Promise<void> {
  return sendCode(email, code, RESET_EMAIL);
}

export const PasswordResetCode = emailCodeProvider("password-reset", RESET_EMAIL);
