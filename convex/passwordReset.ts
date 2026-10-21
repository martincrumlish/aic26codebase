// convex/passwordReset.ts — "Forgot your password?": the Password provider's
// reset flow emails an 8-digit code (valid 15 minutes) via Resend. The code is
// bound to the email it was sent to, and Convex Auth rate-limits wrong guesses.
//
// Unlike transactional email, a reset that can't be sent must FAIL LOUDLY: the
// user is waiting for a code, so we throw a ConvexError the reset page shows.
import { Email } from "@convex-dev/auth/providers/Email";
import { ConvexError } from "convex/values";
import { sendViaResend } from "./lib/resend";

const CODE_LENGTH = 8;
const CODE_TTL_MINUTES = 15;

export function generateResetCode(): string {
  const values = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => (n % 10).toString()).join("");
}

export async function sendResetCode(email: string, code: string): Promise<void> {
  if (!process.env.AUTH_RESEND_KEY) {
    throw new ConvexError(
      "Password reset needs email, and email isn't set up for this app yet. " +
        "Ask your administrator to reset your password.",
    );
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
    throw new ConvexError("Could not send the reset email. Please try again later.");
  }
}

export const PasswordResetCode = Email({
  id: "password-reset",
  maxAge: 60 * CODE_TTL_MINUTES,
  generateVerificationToken: async () => generateResetCode(),
  sendVerificationRequest: async ({ identifier, token }) => sendResetCode(identifier, token),
});
