// convex/googleSignIn.test.ts — the account rules for "Continue with Google".
// The OAuth handshake itself is Convex Auth's; what's ours is authGate's
// decision once Google has said who the person is.
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import createOrUpdateUser from "./authGate";
import { GOOGLE_EMAIL_UNVERIFIED, GOOGLE_USE_PASSWORD, REVOKED, SIGNUP_REJECTED } from "./lib/authMessages";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;

afterEach(() => vi.unstubAllEnvs());

/** What Convex Auth hands authGate after a Google sign-in (see auth.ts's Google profile()). */
function googleArgs(email: string, opts: { verified?: boolean; existingUserId?: Id<"users"> } = {}) {
  return {
    existingUserId: opts.existingUserId ?? null,
    type: "oauth" as const,
    provider: { id: "google" },
    profile: { email, name: "Gina Google", image: "https://img.test/g.png", emailVerified: opts.verified ?? true },
  };
}

const google = (t: T, args: ReturnType<typeof googleArgs>) => t.run((ctx) => createOrUpdateUser(ctx, args));

async function makeUser(t: T, email: string, extra: Record<string, unknown> = {}) {
  return t.run((ctx) =>
    ctx.db.insert("users", { email, role: "user", status: "active", createdVia: "seed", createdAt: Date.now(), ...extra }),
  );
}

async function addPasswordAccount(t: T, userId: Id<"users">, email: string, verified: boolean) {
  await t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId, provider: "password", providerAccountId: email, secret: "hashed",
      ...(verified ? { emailVerified: email } : {}),
    }),
  );
}

describe("Google sign-in: new people", () => {
  test("open mode: creates a normal user with a verified email", async () => {
    const t = convexTest(schema, modules);
    const userId = await google(t, googleArgs("Gina@Example.com"));
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user).toMatchObject({ email: "gina@example.com", name: "Gina Google", role: "user", status: "active", createdVia: "signup" });
    expect(user?.emailVerificationTime).toEqual(expect.any(Number));
  });

  test("link mode: Google can't create accounts", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("SIGNUP_MODE", "link");
    await expect(google(t, googleArgs("new@example.com"))).rejects.toThrow(SIGNUP_REJECTED);
    expect(await t.run((ctx) => ctx.db.query("users").take(5))).toEqual([]);
  });

  test("a Google account whose email isn't verified is refused", async () => {
    const t = convexTest(schema, modules);
    await expect(google(t, googleArgs("x@example.com", { verified: false }))).rejects.toThrow(GOOGLE_EMAIL_UNVERIFIED);
  });
});

describe("Google sign-in: the email already has an account", () => {
  test("a password account that never proved the email is NOT linked (it could be someone squatting the address)", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t, "amy@example.com", { createdVia: "signup" });
    await addPasswordAccount(t, userId, "amy@example.com", false);
    await expect(google(t, googleArgs("amy@example.com"))).rejects.toThrow(GOOGLE_USE_PASSWORD);
  });

  test("a password account that confirmed its email by code is linked", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t, "amy@example.com", { createdVia: "signup" });
    await addPasswordAccount(t, userId, "amy@example.com", true);
    expect(await google(t, googleArgs("amy@example.com"))).toBe(userId);
  });

  test("a pre-created account with no password yet is linked, and its activation links stop working", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("SIGNUP_MODE", "link"); // works in link mode too: the account already exists
    const userId = await makeUser(t, "buyer@example.com", { createdVia: "webhook" });
    const tokenId = await t.run((ctx) =>
      ctx.db.insert("provisioningTokens", {
        token: "act_123", issuerId: userId, targetRole: "user", email: "buyer@example.com",
        maxUses: 1, usedCount: 0, expiresAt: Date.now() + 60_000, revoked: false, purpose: "activation", createdAt: Date.now(),
      }),
    );

    expect(await google(t, googleArgs("buyer@example.com"))).toBe(userId);
    // Otherwise whoever else holds the link could still set a password on it.
    expect((await t.run((ctx) => ctx.db.get(tokenId)))?.revoked).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(userId)))?.emailVerificationTime).toEqual(expect.any(Number));
  });

  test("a revoked account stays locked out", async () => {
    const t = convexTest(schema, modules);
    await makeUser(t, "gone@example.com", { status: "revoked" });
    await expect(google(t, googleArgs("gone@example.com"))).rejects.toThrow(REVOKED);
  });

  test("returning Google users sign straight in; revoked ones don't", async () => {
    const t = convexTest(schema, modules);
    const userId = await google(t, googleArgs("gina@example.com"));
    expect(await google(t, googleArgs("gina@example.com", { existingUserId: userId }))).toBe(userId);
    await t.run((ctx) => ctx.db.patch(userId, { status: "revoked" }));
    await expect(google(t, googleArgs("gina@example.com", { existingUserId: userId }))).rejects.toThrow(REVOKED);
  });
});

describe("confirming an email by code", () => {
  test("records the email as verified on the user (so Google can link to it later)", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t, "amy@example.com");
    await t.run((ctx) =>
      createOrUpdateUser(ctx, {
        existingUserId: userId,
        type: "verification",
        provider: { id: "password" },
        profile: { email: "amy@example.com", emailVerified: true },
      }),
    );
    expect((await t.run((ctx) => ctx.db.get(userId)))?.emailVerificationTime).toEqual(expect.any(Number));
  });
});

describe("signup.googleEnabled", () => {
  test("true only when both Google env vars are set", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.signup.googleEnabled, {})).toBe(false);
    vi.stubEnv("AUTH_GOOGLE_ID", "123.apps.googleusercontent.com");
    expect(await t.query(api.signup.googleEnabled, {})).toBe(false);
    vi.stubEnv("AUTH_GOOGLE_SECRET", "GOCSPX-secret");
    expect(await t.query(api.signup.googleEnabled, {})).toBe(true);
  });
});
