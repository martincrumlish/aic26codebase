// convex/passwordReset.test.ts — "Forgot your password?" via an emailed code.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { generateResetCode, sendResetCode } from "./passwordReset";

const modules = import.meta.glob("./**/*.ts");

// Convex Auth signs session JWTs and reads SITE_URL (both set by `npm run
// setup` on real deployments); give it throwaway values for the test.
async function stubAuthEnv() {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const b64 = btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n");
  vi.stubEnv("JWT_PRIVATE_KEY", `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`);
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
}

/** Stub Resend; returns the list of codes that were "emailed". */
function stubResend() {
  const sent: { to: string; html: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      sent.push({ to: body.to[0], html: body.html });
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    }),
  );
  return sent;
}

const codeFrom = (html: string) => html.match(/\b(\d{8})\b/)![1];

beforeEach(() => vi.stubEnv("AUTH_RESEND_KEY", "re_test_123"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("generateResetCode", () => {
  test("returns 8 random digits", () => {
    const a = generateResetCode();
    const b = generateResetCode();
    expect(a).toMatch(/^\d{8}$/);
    expect(b).toMatch(/^\d{8}$/);
    expect(a).not.toBe(b);
  });
});

describe("sendResetCode", () => {
  test("emails the code to the address via Resend", async () => {
    const sent = stubResend();
    await sendResetCode("a@x.com", "12345678");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("a@x.com");
    expect(sent[0].html).toContain("12345678");
  });

  test("explains that email isn't set up when AUTH_RESEND_KEY is missing", async () => {
    vi.stubEnv("AUTH_RESEND_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(sendResetCode("a@x.com", "12345678")).rejects.toThrow(/email isn't set up/i);
    expect(spy).not.toHaveBeenCalled();
  });

  test("reports a send failure instead of pretending it worked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 422 })));
    await expect(sendResetCode("a@x.com", "12345678")).rejects.toThrow(/could not send/i);
  });
});

describe("password reset through auth:signIn", () => {
  test("request a code, set a new password with it, then sign in with the new password", async () => {
    await stubAuthEnv();
    const sent = stubResend();
    const t = convexTest(schema, modules);

    // An admin-created account (exercises the real password hashing).
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "admin@x.com", role: "admin", status: "active",
        createdVia: "seed", createdAt: Date.now(),
      }),
    );
    await t.withIdentity({ subject: adminId }).action(api.admin.createUserAccount, {
      email: "forgetful@x.com",
      password: "original-password",
    });

    // 1. Request a reset code.
    await t.action(api.auth.signIn, {
      provider: "password",
      params: { email: "forgetful@x.com", flow: "reset" },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("forgetful@x.com");
    const code = codeFrom(sent[0].html);

    // 2. A wrong code is rejected.
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { email: "forgetful@x.com", flow: "reset-verification", code: "00000000", newPassword: "brand-new-password" },
      }),
    ).rejects.toThrow();

    // 3. The emailed code sets the new password and signs the user in.
    const result = await t.action(api.auth.signIn, {
      provider: "password",
      params: { email: "forgetful@x.com", flow: "reset-verification", code, newPassword: "brand-new-password" },
    });
    expect(result.tokens).toBeTruthy();

    // 4. The new password works; the old one no longer does.
    const signedIn = await t.action(api.auth.signIn, {
      provider: "password",
      params: { email: "forgetful@x.com", flow: "signIn", password: "brand-new-password" },
    });
    expect(signedIn.tokens).toBeTruthy();
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { email: "forgetful@x.com", flow: "signIn", password: "original-password" },
      }),
    ).rejects.toThrow();
  });
});
