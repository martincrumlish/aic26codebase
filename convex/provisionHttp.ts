// convex/provisionHttp.ts
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const provisionWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.PROVISION_WEBHOOK_SECRET;
  if (!secret) return new Response("Server misconfigured", { status: 500 });

  // 1. RAW body (hash exactly what was signed).
  const raw = await request.text();

  // 2. Verify HMAC-SHA256.
  const provided = request.headers.get("x-app-signature") ?? "";
  const expected = await hmacSha256Hex(secret, raw);
  if (!timingSafeEqualHex(provided, expected)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // 3. Parse after verification.
  let payload: {
    externalId: string;
    source: string;
    type: string;
    email: string;
    role: "operator" | "creator" | "member";
    creatorScopeId?: string;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // 4. Idempotent provision inside a single mutation.
  const result = await ctx.runMutation(internal.provisioning.ingestEvent, {
    externalId: payload.externalId,
    source: payload.source,
    type: payload.type,
    email: payload.email.toLowerCase().trim(),
    role: payload.role,
    creatorScopeId: payload.creatorScopeId,
  });

  return Response.json({ ok: true, deduped: result.deduped });
});
