// convex/email.ts — all transactional email goes through this one module.
//
// Fail-soft contract: `send` NEVER throws. Missing AUTH_RESEND_KEY, a Resend
// error response, or a network failure all return {sent:false, reason} so
// callers can treat email as best-effort.
import { action, internalAction, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireOperator, requireUser } from "./access";

const SendResult = v.object({
  sent: v.boolean(),
  id: v.optional(v.string()),
  reason: v.optional(v.string()),
});
type SendResult = { sent: boolean; id?: string; reason?: string };

export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  returns: SendResult,
  handler: async (_ctx, args): Promise<SendResult> => {
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) return { sent: false, reason: "no-key" };

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.AUTH_EMAIL_FROM ?? "App <onboarding@resend.dev>",
          to: [args.to],
          subject: args.subject,
          html: args.html,
        }),
      });
      if (!res.ok) return { sent: false, reason: `resend-${res.status}` };
      const data = (await res.json()) as { id?: string };
      return { sent: true, id: data.id };
    } catch {
      return { sent: false, reason: "network" };
    }
  },
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
export const assertOperator = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOperator(ctx);
    return null;
  },
});

/** Operator-only: email a creator invite link for an already-created token. */
export const sendCreatorInvite = action({
  args: { email: v.string(), token: v.string() },
  returns: SendResult,
  handler: async (ctx, args): Promise<SendResult> => {
    await ctx.runQuery(internal.email.assertOperator, {});
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
