// convex/accountTakeover.test.ts — regression tests: a pre-created account
// (first admin, webhook customer) can only be claimed with ITS activation link.
// These drive the real auth:signIn action exactly as an attacker would.
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { stubAuthEnv } from "../vitest/authEnv";

const modules = import.meta.glob("./**/*.ts");

beforeEach(async () => {
  await stubAuthEnv();
  vi.stubEnv("ADMIN_EMAIL", "owner@example.com");
});
afterEach(() => vi.unstubAllEnvs());

function signUp(t: TestConvex<typeof schema>, email: string, password: string, token?: string) {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signUp", email, password, ...(token ? { token } : {}) },
  });
}

function passwordAccounts(t: TestConvex<typeof schema>, email: string) {
  return t.run((ctx) =>
    ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .collect(),
  );
}

async function activationTokenFor(t: TestConvex<typeof schema>, email: string) {
  const rows = await t.run((ctx) => ctx.db.query("provisioningTokens").take(100));
  return rows.find((r) => r.purpose === "activation" && r.email === email)!.token;
}

describe("claiming a pre-created account requires its activation link", () => {
  test("a stranger can't claim the not-yet-activated admin with a plain sign-up", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.bootstrapAdmin, {});

    await expect(signUp(t, "owner@example.com", "attacker-pass-123")).rejects.toThrow(
      /not enabled/i,
    );
    expect(await passwordAccounts(t, "owner@example.com")).toHaveLength(0);
  });

  test("a signup link can't be used to claim a pre-created account", async () => {
    const t = convexTest(schema, modules);
    const { userId: adminId } = await t.mutation(internal.seed.bootstrapAdmin, {});
    await t.run((ctx) =>
      ctx.db.insert("provisioningTokens", {
        token: "public-signup-link", issuerId: adminId, targetRole: "user",
        usedCount: 0, revoked: false, purpose: "signup", createdAt: Date.now(),
      }),
    );

    await expect(
      signUp(t, "owner@example.com", "attacker-pass-123", "public-signup-link"),
    ).rejects.toThrow(/not enabled/i);
    expect(await passwordAccounts(t, "owner@example.com")).toHaveLength(0);
  });

  test("one customer's activation link can't claim another customer's account", async () => {
    const t = convexTest(schema, modules);
    for (const [i, email] of ["alice@x.com", "bob@x.com"].entries()) {
      await t.mutation(internal.provisioning.ingestEvent, {
        externalId: `evt_${i}`, source: "billing", type: "grant", email,
      });
    }
    const alicesLink = await activationTokenFor(t, "alice@x.com");

    await expect(signUp(t, "bob@x.com", "attacker-pass-123", alicesLink)).rejects.toThrow(
      /not enabled/i,
    );
    expect(await passwordAccounts(t, "bob@x.com")).toHaveLength(0);
  });

  test("the real admin activates with the seed's link, and it's used up", async () => {
    const t = convexTest(schema, modules);
    const { userId, activationToken } = await t.mutation(internal.seed.bootstrapAdmin, {});

    const res = await signUp(t, "owner@example.com", "owner-pass-123", activationToken!);
    expect(res.tokens).toBeTruthy();
    const accounts = await passwordAccounts(t, "owner@example.com");
    expect(accounts).toHaveLength(1);
    expect(accounts[0].userId).toBe(userId);
    expect((await t.run((ctx) => ctx.db.get(userId)))?.role).toBe("admin");

    const status = await t.query(api.provisioning.validateToken, { token: activationToken! });
    expect(status.valid).toBe(false);
  });

  test("a webhook customer activates with their own link", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await t.mutation(internal.provisioning.ingestEvent, {
      externalId: "evt_buy", source: "billing", type: "grant", email: "buyer@x.com",
    });
    const link = await activationTokenFor(t, "buyer@x.com");

    const res = await signUp(t, "buyer@x.com", "buyer-pass-123", link);
    expect(res.tokens).toBeTruthy();
    expect((await passwordAccounts(t, "buyer@x.com"))[0].userId).toBe(userId);
  });
});
