// convex/passwordReset.test.ts — "Forgot your password?" via an emailed code.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import schema from "./schema";
import { api } from "./_generated/api";
import { generateResetCode, sendResetCode } from "./passwordReset";
import { stubAuthEnv } from "../vitest/authEnv";

const modules = import.meta.glob("./**/*.ts");

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

  // These failures happen only AFTER Convex Auth has found the account, while
  // an unknown email fails earlier with a plain error. Using plain errors here
  // too (which Convex redacts in production) means a caller can't tell
  // "account exists" from "no such account" by which error comes back.
  test("fails with a plain (non-ConvexError) error when AUTH_RESEND_KEY is missing", async () => {
    vi.stubEnv("AUTH_RESEND_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const err = await sendResetCode("a@x.com", "12345678").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ConvexError);
    expect(err.message).toMatch(/email isn't set up/i);
    expect(spy).not.toHaveBeenCalled();
  });

  test("reports a send failure with a plain error instead of pretending it worked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 422 })));
    const err = await sendResetCode("a@x.com", "12345678").catch((e) => e);
    expect(err).not.toBeInstanceOf(ConvexError);
    expect(err.message).toMatch(/could not send/i);
  });
});

describe("passwordReset.available", () => {
  test("tells signed-out visitors whether reset is possible (email configured)", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("AUTH_RESEND_KEY", "");
    expect(await t.query(api.passwordReset.available, {})).toBe(false);
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
    expect(await t.query(api.passwordReset.available, {})).toBe(true);
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
