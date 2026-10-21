// convex/authErrors.test.ts — sign-in and sign-up must not reveal which emails
// have accounts, and revoked users must be locked out of sign-in.
// Drives the real auth:signIn action with real password hashing.
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { stubAuthEnv } from "../vitest/authEnv";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;

beforeEach(stubAuthEnv);
afterEach(() => vi.unstubAllEnvs());

/** The rejection message, or "resolved" if the call succeeded. */
const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "resolved",
    (e: Error) => e.message,
  );

function signIn(t: T, flow: "signIn" | "signUp", email: string, password: string) {
  return t.action(api.auth.signIn, { provider: "password", params: { flow, email, password } });
}

/** An admin, plus a user account with password "user-password-1". */
async function setup(t: T) {
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "admin@x.com", role: "admin", status: "active",
      createdVia: "seed", createdAt: Date.now(),
    }),
  );
  const asAdmin = t.withIdentity({ subject: adminId });
  const { userId } = await asAdmin.action(api.admin.createUserAccount, {
    email: "member@x.com",
    password: "user-password-1",
  });
  return { asAdmin, userId };
}

const sessionsOf = (t: T, userId: Id<"users">) =>
  t.run((ctx) =>
    ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).collect(),
  );

// In open mode an unknown email can simply sign up, so the "same answer"
// guarantee is about link-only mode. (Any app with open sign-up reveals that
// an email is taken when someone tries to register it.)
describe("link-only sign-up never reveals whether an email has an account", () => {
  test("an existing account, an unknown email, and an unclaimed pre-created account all get the same answer", async () => {
    vi.stubEnv("SIGNUP_MODE", "link");
    const t = convexTest(schema, modules);
    await setup(t);
    await t.mutation(internal.provisioning.ingestEvent, {
      externalId: "evt_pre", source: "billing", type: "grant", email: "precreated@x.com",
    });

    const existing = await outcome(signIn(t, "signUp", "member@x.com", "some-password-1"));
    const unknown = await outcome(signIn(t, "signUp", "nobody@x.com", "some-password-1"));
    const precreated = await outcome(signIn(t, "signUp", "precreated@x.com", "some-password-1"));

    expect(existing).toMatch(/couldn't create an account/i);
    expect(unknown).toBe(existing);
    expect(precreated).toBe(existing);
  });

  test("a too-short password says so (that reveals nothing about the account)", async () => {
    const t = convexTest(schema, modules);
    expect(await outcome(signIn(t, "signUp", "nobody@x.com", "short"))).toMatch(
      /at least 8 characters/i,
    );
  });
});

describe("sign-in never reveals whether an email has an account", () => {
  test("a wrong password and an unknown email get the same answer", async () => {
    const t = convexTest(schema, modules);
    await setup(t);

    const wrongPassword = await outcome(signIn(t, "signIn", "member@x.com", "wrong-password-1"));
    const unknownEmail = await outcome(signIn(t, "signIn", "nobody@x.com", "wrong-password-1"));

    expect(wrongPassword).toMatch(/invalid email or password/i);
    expect(unknownEmail).toBe(wrongPassword);
  });
});

describe("revoked users are locked out", () => {
  test("a revoked user can't sign in even with the right password; restoring lets them back in", async () => {
    const t = convexTest(schema, modules);
    const { asAdmin, userId } = await setup(t);

    await asAdmin.mutation(api.admin.revokeUser, { userId });
    expect(await outcome(signIn(t, "signIn", "member@x.com", "user-password-1"))).toMatch(
      /revoked/i,
    );

    await asAdmin.mutation(api.admin.restoreUser, { userId });
    expect(await outcome(signIn(t, "signIn", "member@x.com", "user-password-1"))).toBe("resolved");
  });

  test("revoking ends the user's existing sessions immediately", async () => {
    const t = convexTest(schema, modules);
    const { asAdmin, userId } = await setup(t);
    await signIn(t, "signIn", "member@x.com", "user-password-1");
    expect((await sessionsOf(t, userId)).length).toBeGreaterThan(0);

    await asAdmin.mutation(api.admin.revokeUser, { userId });

    expect(await sessionsOf(t, userId)).toHaveLength(0);
    const refreshTokens = await t.run((ctx) => ctx.db.query("authRefreshTokens").take(100));
    const sessionIds = new Set((await sessionsOf(t, userId)).map((s) => s._id));
    expect(refreshTokens.filter((r) => sessionIds.has(r.sessionId))).toHaveLength(0);
  });
});
