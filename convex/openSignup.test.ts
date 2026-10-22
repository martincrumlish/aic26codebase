// convex/openSignup.test.ts — open sign-up (the default), link-only mode, and
// email confirmation when email is set up. Drives the real auth:signIn action.
import { convexTest as baseConvexTest, type TestConvex } from "convex-test";
import { registerRateLimiter } from "../vitest/rateLimiter";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { stubAuthEnv } from "../vitest/authEnv";

const modules = import.meta.glob("./**/*.ts");

// Every test backend here needs the rate limiter (emailed codes are limited).
function convexTest(s: typeof schema, m: typeof modules) {
  const t = baseConvexTest(s, m);
  registerRateLimiter(t);
  return t;
}
type T = TestConvex<typeof schema>;

beforeEach(stubAuthEnv);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function signIn(t: T, params: Record<string, string>) {
  return t.action(api.auth.signIn, { provider: "password", params });
}
const signUp = (t: T, email: string, password: string) =>
  signIn(t, { flow: "signUp", email, password });

const userByEmail = (t: T, email: string) =>
  t.run((ctx) => ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique());

/** Stub Resend; returns the emails that were "sent". */
function stubEmail() {
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
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

describe("open sign-up (the default)", () => {
  test("anyone can sign up with an email and password and is signed straight in as a user", async () => {
    const t = convexTest(schema, modules);
    const res = await signUp(t, "New.Person@x.com", "new-person-pw-1");
    expect(res.tokens).toBeTruthy();

    const user = await userByEmail(t, "new.person@x.com");
    expect(user?.role).toBe("user");
    expect(user?.status).toBe("active");
    expect(user?.createdVia).toBe("signup");
  });

  test("signup.mode reports open by default, and link when SIGNUP_MODE=link", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.signup.mode, {})).toBe("open");
    vi.stubEnv("SIGNUP_MODE", "link");
    expect(await t.query(api.signup.mode, {})).toBe("link");
  });

  test("pre-created accounts still need their own activation link", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.provisioning.ingestEvent, {
      externalId: "evt_1", source: "billing", type: "grant", email: "buyer@x.com",
    });
    await expect(signUp(t, "buyer@x.com", "attacker-pass-123")).rejects.toThrow(
      /couldn't create an account/i,
    );
  });
});

describe("link-only mode (SIGNUP_MODE=link)", () => {
  test("sign-up without a signup link is refused and creates nothing", async () => {
    vi.stubEnv("SIGNUP_MODE", "link");
    const t = convexTest(schema, modules);
    await expect(signUp(t, "someone@x.com", "some-password-1")).rejects.toThrow(
      /couldn't create an account/i,
    );
    expect(await userByEmail(t, "someone@x.com")).toBeNull();
  });
});

describe("email confirmation (when email is set up)", () => {
  test("sign-up emails a code instead of signing in; the code signs them in; later sign-ins need no code", async () => {
    const sent = stubEmail();
    const t = convexTest(schema, modules);

    const res = await signUp(t, "confirm@x.com", "confirm-pass-1");
    expect(res.tokens).toBeFalsy();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("confirm@x.com");

    await expect(
      signIn(t, { flow: "email-verification", email: "confirm@x.com", code: "00000000" }),
    ).rejects.toThrow(/invalid or expired/i);

    const ok = await signIn(t, {
      flow: "email-verification", email: "confirm@x.com", code: codeFrom(sent[0].html),
    });
    expect(ok.tokens).toBeTruthy();

    const later = await signIn(t, { flow: "signIn", email: "confirm@x.com", password: "confirm-pass-1" });
    expect(later.tokens).toBeTruthy();
    expect(sent).toHaveLength(1);
  });

  test("an older account that never confirmed gets a code at its next sign-in", async () => {
    const t = convexTest(schema, modules);
    await signUp(t, "older@x.com", "older-pass-123"); // email not set up yet: no code

    const sent = stubEmail(); // email gets switched on later
    const res = await signIn(t, { flow: "signIn", email: "older@x.com", password: "older-pass-123" });
    expect(res.tokens).toBeFalsy();
    expect(sent).toHaveLength(1);
  });
});
