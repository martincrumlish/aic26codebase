// convex/lib/resend.ts — the single place that talks to the Resend API.
// Used by email.send (transactional email) and passwordReset (reset codes).
//
// Fail-soft: never throws. Missing AUTH_RESEND_KEY, a Resend error response,
// or a network failure all return {sent:false, reason}.

export type SendResult = { sent: boolean; id?: string; reason?: string };

export async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
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
}
