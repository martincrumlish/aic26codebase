// convex/googleConnect.test.ts — "Connect Google" from Settings: a signed-in
// user adds Google as a way to sign in. These drive the real auth:store step
// that Convex Auth runs when Google redirects back.
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { GOOGLE_USE_PASSWORD } from "./lib/authMessages";
import { stubAuthEnv } from "../vitest/authEnv";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;

beforeEach(async () => {
  await stubAuthEnv();
  vi.stubEnv("AUTH_GOOGLE_ID", "test.apps.googleusercontent.com");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "GOCSPX-test");
});
afterEach(() => vi.unstubAllEnvs());

async function makePasswordUser(t: T, email: string) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email, role: "user", status: "active", createdVia: "signup", createdAt: Date.now(),
    });
    // Never confirmed its email (the case "Continue with Google" refuses).
    await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: email, secret: "hashed" });
    return userId;
  });
}

async function sessionFor(t: T, userId: Id<"users">, expiresIn = 60_000) {
  return t.run((ctx) => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + expiresIn }));
}

/** Google redirects back: the pending sign-in (verifier) remembers who started it, if anyone. */
async function googleReturns(
  t: T,
  opts: { sessionId?: Id<"authSessions">; googleId?: string; email: string; verified?: boolean },
) {
  const signature = `sig-${Math.random()}`;
  await t.run((ctx) => ctx.db.insert("authVerifiers", { sessionId: opts.sessionId, signature }));
  return t.mutation(internal.auth.store, {
    args: {
      type: "userOAuth",
      provider: "google",
      providerAccountId: opts.googleId ?? "google-123",
      profile: { email: opts.email, name: "Amy", emailVerified: opts.verified ?? true },
      signature,
    },
  });
}

const googleAccounts = (t: T) =>
  t.run((ctx) =>
    ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "google"))
      .take(10),
  );

describe("Connect Google (signed in)", () => {
  test("adds Google to the signed-in account, even though its email was never confirmed", async () => {
    const t = convexTest(schema, modules);
    const amy = await makePasswordUser(t, "amy@gmail.com");
    const code = await googleReturns(t, { sessionId: await sessionFor(t, amy), email: "amy@gmail.com" });

    expect(code).toEqual(expect.any(String)); // the flow completes and signs them in
    const accounts = await googleAccounts(t);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ userId: amy, providerAccountId: "google-123", emailVerified: "amy@gmail.com" });
    // Google proved the address, so it now counts as confirmed.
    expect((await t.run((ctx) => ctx.db.get(amy)))?.emailVerificationTime).toEqual(expect.any(Number));
    // No second account was made.
    expect(await t.run((ctx) => ctx.db.query("users").take(5))).toHaveLength(1);
  });

  test("afterwards, Continue with Google signs straight into that account", async () => {
    const t = convexTest(schema, modules);
    const amy = await makePasswordUser(t, "amy@gmail.com");
    await googleReturns(t, { sessionId: await sessionFor(t, amy), email: "amy@gmail.com" });

    await googleReturns(t, { email: "amy@gmail.com" }); // signed out this time
    const accounts = await googleAccounts(t);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].userId).toBe(amy);
  });

  test("a Google account with a different email can be connected too (it's the signed-in person's choice)", async () => {
    const t = convexTest(schema, modules);
    const amy = await makePasswordUser(t, "amy@work.com");
    await googleReturns(t, { sessionId: await sessionFor(t, amy), email: "amy.personal@gmail.com" });
    expect((await googleAccounts(t))[0].userId).toBe(amy);
    // Only a matching address marks the account's own email as confirmed.
    expect((await t.run((ctx) => ctx.db.get(amy)))?.emailVerificationTime).toBeUndefined();
  });

  test("a Google account already used by someone else isn't moved", async () => {
    const t = convexTest(schema, modules);
    const ben = await makePasswordUser(t, "ben@gmail.com");
    await googleReturns(t, { sessionId: await sessionFor(t, ben), email: "shared@gmail.com" });
    const amy = await makePasswordUser(t, "amy@gmail.com");

    await expect(
      googleReturns(t, { sessionId: await sessionFor(t, amy), email: "shared@gmail.com" }),
    ).rejects.toThrow(/already connected to a different account/i);
    expect((await googleAccounts(t))[0].userId).toBe(ben);
  });

  test("one Google account per user: disconnect first to switch", async () => {
    const t = convexTest(schema, modules);
    const amy = await makePasswordUser(t, "amy@gmail.com");
    await googleReturns(t, { sessionId: await sessionFor(t, amy), email: "amy@gmail.com", googleId: "g-1" });
    await expect(
      googleReturns(t, { sessionId: await sessionFor(t, amy), email: "other@gmail.com", googleId: "g-2" }),
    ).rejects.toThrow(/already has a Google account connected/i);
  });

  test("an expired session counts as signed out, so the usual safety rule applies", async () => {
    const t = convexTest(schema, modules);
    const amy = await makePasswordUser(t, "amy@gmail.com");
    await expect(
      googleReturns(t, { sessionId: await sessionFor(t, amy, -1000), email: "amy@gmail.com" }),
    ).rejects.toThrow(GOOGLE_USE_PASSWORD);
    expect(await googleAccounts(t)).toEqual([]);
  });

  test("signed out: an unconfirmed password account is still refused (unchanged)", async () => {
    const t = convexTest(schema, modules);
    await makePasswordUser(t, "amy@gmail.com");
    await expect(googleReturns(t, { email: "amy@gmail.com" })).rejects.toThrow(GOOGLE_USE_PASSWORD);
  });
});

describe("google.status and google.disconnect", () => {
  test("shows whether Google is set up and connected, and which address", async () => {
    const t = convexTest(schema, modules);
    const amy = await makePasswordUser(t, "amy@gmail.com");
    const asAmy = t.withIdentity({ subject: `${amy}|s` });
    expect(await asAmy.query(api.google.status, {})).toEqual({ enabled: true, connected: false });
    await googleReturns(t, { sessionId: await sessionFor(t, amy), email: "amy@gmail.com" });
    expect(await asAmy.query(api.google.status, {})).toEqual({ enabled: true, connected: true, email: "amy@gmail.com" });

    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    expect(await asAmy.query(api.google.status, {})).toMatchObject({ enabled: false });
  });

  test("disconnect removes Google; the password still works", async () => {
    const t = convexTest(schema, modules);
    const amy = await makePasswordUser(t, "amy@gmail.com");
    await googleReturns(t, { sessionId: await sessionFor(t, amy), email: "amy@gmail.com" });
    await t.withIdentity({ subject: `${amy}|s` }).mutation(api.google.disconnect, {});
    expect(await googleAccounts(t)).toEqual([]);
  });

  test("won't disconnect the only way to sign in", async () => {
    const t = convexTest(schema, modules);
    // A Google-only account (made by Continue with Google; no password).
    const signature = "sig-new";
    await t.run((ctx) => ctx.db.insert("authVerifiers", { signature }));
    await t.mutation(internal.auth.store, {
      args: {
        type: "userOAuth", provider: "google", providerAccountId: "g-only",
        profile: { email: "gina@gmail.com", emailVerified: true }, signature,
      },
    });
    const gina = (await googleAccounts(t))[0].userId;
    await expect(
      t.withIdentity({ subject: `${gina}|s` }).mutation(api.google.disconnect, {}),
    ).rejects.toThrow(/only way you sign in/i);
  });
});
