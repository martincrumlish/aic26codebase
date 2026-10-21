// convex/email.ts — transactional email for app code. Call internal.email.send
// from any action; don't call the Resend API directly.
//
// Fail-soft contract: `send` NEVER throws. Missing AUTH_RESEND_KEY, a Resend
// error response, or a network failure all return {sent:false, reason} so
// callers can treat email as best-effort.
import { action, internalAction, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./access";
import { sendViaResend, type SendResult } from "./lib/resend";

const SendResult = v.object({
  sent: v.boolean(),
  id: v.optional(v.string()),
  reason: v.optional(v.string()),
});

export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  returns: SendResult,
  handler: async (_ctx, args): Promise<SendResult> => sendViaResend(args),
});

/** Whether transactional email is configured — lets the UI hide email fields. */
export const emailEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    await requireUser(ctx);
    return !!process.env.AUTH_RESEND_KEY;
  },
});

/** Internal auth gate for actions (no db on action ctx). */
export const assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

/** Admin-only: email a signup link for an already-created token. */
export const sendSignupInvite = action({
  args: { email: v.string(), token: v.string() },
  returns: SendResult,
  handler: async (ctx, args): Promise<SendResult> => {
    await ctx.runQuery(internal.email.assertAdmin, {});
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const joinUrl = `${siteUrl}/join/${args.token}`;
    return await ctx.runAction(internal.email.send, {
      to: args.email.toLowerCase().trim(),
      subject: "You're invited",
      html: [
        `<p>You've been invited to create an account.</p>`,
        `<p><a href="${joinUrl}">Accept your invite</a></p>`,
        `<p>Or paste this link into your browser: ${joinUrl}</p>`,
      ].join("\n"),
    });
  },
});
