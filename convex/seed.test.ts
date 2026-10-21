// convex/seed.test.ts
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", "Admin@Example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("seed.bootstrapAdmin", () => {
  test("creates an admin + single-use activation token, idempotent", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.seed.bootstrapAdmin, {});
    expect(first.created).toBe(true);
    expect(first.activationToken).toBeTypeOf("string");

    const admin = await t.run((ctx) =>
      ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "admin@example.com")).unique(),
    );
    expect(admin?.role).toBe("admin");
    expect(admin?.createdVia).toBe("seed");

    const tokens = await t.run((ctx) => ctx.db.query("provisioningTokens").collect());
    expect(tokens).toHaveLength(1);
    expect(tokens[0].purpose).toBe("activation");
    expect(tokens[0].maxUses).toBe(1);

    // Re-run is idempotent: no second admin, no second token.
    const second = await t.mutation(internal.seed.bootstrapAdmin, {});
    expect(second.created).toBe(false);
    expect(second.activationToken).toBeNull();
    const tokensAfter = await t.run((ctx) => ctx.db.query("provisioningTokens").collect());
    expect(tokensAfter).toHaveLength(1);
  });

  test("throws when ADMIN_EMAIL is unset", async () => {
    vi.unstubAllEnvs();
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.seed.bootstrapAdmin, {})).rejects.toThrow(/ADMIN_EMAIL/);
  });
});
