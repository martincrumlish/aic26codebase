// convex/passwordReset.ts — "Forgot your password?": the Password provider's
// reset flow emails an 8-digit code (valid 15 minutes) via Resend. The code is
// bound to the email it was sent to, and Convex Auth rate-limits wrong guesses.
//
// Failures here throw PLAIN Errors, not ConvexErrors. They only happen after
// Convex Auth has found the account, while an unknown email fails earlier with
// a plain error; Convex redacts plain error messages in production, so a caller
// can't tell "account exists" from "no such account". The reset page checks
// `available` first and explains a missing email setup before asking anything.
import { Email } from "@convex-dev/auth/providers/Email";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { sendViaResend } from "./lib/resend";

const CODE_LENGTH = 8;
const CODE_TTL_MINUTES = 15;

export function generateResetCode(): string {
  const values = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => (n % 10).toString()).join("");
}

/**
 * Public on purpose (no sign-in needed: it's for the "Forgot your password?"
 * page). Reveals only whether email is configured, not anything about users.
 */
export const available = query({
  args: {},
  returns: v.boolean(),
  handler: async () => !!process.env.AUTH_RESEND_KEY,
});

export async function sendResetCode(email: string, code: string): Promise<void> {
  if (!process.env.AUTH_RESEND_KEY) {
    throw new Error("Password reset needs email, and email isn't set up for this app yet.");
  }
  const result = await sendViaResend({
    to: email,
    subject: "Your password reset code",
    html: [
      `<p>Use this code to reset your password:</p>`,
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>`,
      `<p>It expires in ${CODE_TTL_MINUTES} minutes. If you didn't ask to reset your password, you can ignore this email.</p>`,
    ].join("\n"),
  });
  if (!result.sent) {
    throw new Error(`Could not send the reset email (${result.reason}).`);
  }
}

export const PasswordResetCode = Email({
  id: "password-reset",
  maxAge: 60 * CODE_TTL_MINUTES,
  generateVerificationToken: async () => generateResetCode(),
  sendVerificationRequest: async ({ identifier, token }) => sendResetCode(identifier, token),
});
