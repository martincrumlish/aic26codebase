// convex/lib/emailCode.ts — 8-digit codes sent by email, valid 15 minutes.
// Used for password reset and for confirming an email address. Each code is
// bound to the address it was sent to, and Convex Auth rate-limits wrong
// guesses.
//
// Failures throw PLAIN Errors, not ConvexErrors. They only happen after Convex
// Auth has found the account, while an unknown email fails earlier with a
// plain error; Convex redacts plain error messages in production, so a caller
// can't tell "account exists" from "no such account".
import { Email } from "@convex-dev/auth/providers/Email";
import type { ActionCtx } from "../_generated/server";
import { sendViaResend } from "./resend";
import { mayEmailCode } from "./rateLimits";

const CODE_LENGTH = 8;
export const CODE_TTL_MINUTES = 15;

export function generateCode(): string {
  const values = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => (n % 10).toString()).join("");
}

type CodeEmail = { subject: string; intro: string; ignoreIf: string };

export async function sendCode(email: string, code: string, message: CodeEmail): Promise<void> {
  if (!process.env.AUTH_RESEND_KEY) {
    throw new Error("Sending this code needs email, and email isn't set up for this app yet.");
  }
  const result = await sendViaResend({
    to: email,
    subject: message.subject,
    html: [
      `<p>${message.intro}</p>`,
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>`,
      `<p>It expires in ${CODE_TTL_MINUTES} minutes. If you didn't ${message.ignoreIf}, you can ignore this email.</p>`,
    ].join("\n"),
  });
  if (!result.sent) {
    throw new Error(`Could not send the email (${result.reason}).`);
  }
}

/** A Convex Auth email provider that sends `message` with a fresh code. */
export function emailCodeProvider(id: string, message: CodeEmail) {
  return Email({
    id,
    maxAge: 60 * CODE_TTL_MINUTES,
    generateVerificationToken: async () => generateCode(),
    // Convex Auth passes the action ctx as a second argument (untyped).
    sendVerificationRequest: async ({ identifier, token }, ...rest: unknown[]) => {
      const ctx = rest[0] as ActionCtx;
      if (!process.env.AUTH_RESEND_KEY) return sendCode(identifier, token, message); // explains the setup
      // Over the limit: skip quietly, so the response looks like any other.
      if (!(await mayEmailCode(ctx, identifier))) return;
      return sendCode(identifier, token, message);
    },
  });
}

/** Confirms a new (or never-confirmed) account's email address. */
export const EmailConfirmationCode = emailCodeProvider("email-confirmation", {
  subject: "Confirm your email address",
  intro: "Enter this code to confirm your email address:",
  ignoreIf: "just create an account",
});
