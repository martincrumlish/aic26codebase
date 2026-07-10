// convex/provisioning.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

describe("provisioning.ingestEvent", () => {
  test("creates a pending user + single-use activation token, idempotent on externalId", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.provisioning.ingestEvent, {
      externalId: "evt_1",
      source: "billing",
      type: "grant",
      email: "Creator@X.com",
      role: "creator",
    });
    expect(first.deduped).toBe(false);

    // user created with normalized email + webhook provenance
    const user = await t.run((ctx) =>
      ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "creator@x.com")).unique(),
    );
    expect(user?.role).toBe("creator");
    expect(user?.createdVia).toBe("webhook");
    expect(user?.status).toBe("active");

    // one activation token, single-use, purpose "activation"
    const tokens = await t.run((ctx) => ctx.db.query("provisioningTokens").collect());
    expect(tokens).toHaveLength(1);
    expect(tokens[0].purpose).toBe("activation");
    expect(tokens[0].maxUses).toBe(1);

    // replay same externalId → deduped, no second token, no second user
    const second = await t.mutation(internal.provisioning.ingestEvent, {
      externalId: "evt_1",
      source: "billing",
      type: "grant",
      email: "creator@x.com",
      role: "creator",
    });
    expect(second.deduped).toBe(true);
    expect(second.userId).toBe(first.userId);
    const tokensAfter = await t.run((ctx) => ctx.db.query("provisioningTokens").collect());
    expect(tokensAfter).toHaveLength(1);
    const events = await t.run((ctx) => ctx.db.query("provisioningEvents").collect());
    expect(events).toHaveLength(1);
  });

  test("a prior FAILED event row (no userId) is not silently re-processed into a duplicate", async () => {
    const t = convexTest(schema, modules);
    // Simulate a future failed-ingest row: same externalId, status failed, no userId.
    await t.run((ctx) =>
      ctx.db.insert("provisioningEvents", {
        externalId: "evt_failed",
        source: "billing",
        type: "grant",
        targetEmail: "creator@x.com",
        role: "creator",
        status: "failed",
        receivedAt: Date.now(),
      }),
    );
    await expect(
      t.mutation(internal.provisioning.ingestEvent, {
        externalId: "evt_failed",
        source: "billing",
        type: "grant",
        email: "creator@x.com",
        role: "creator",
      }),
    ).rejects.toThrow(/prior provisioning attempt/i);
    // No duplicate event row, no user, no token were created by the replay.
    const events = await t.run((ctx) => ctx.db.query("provisioningEvents").collect());
    expect(events).toHaveLength(1);
    const tokens = await t.run((ctx) => ctx.db.query("provisioningTokens").collect());
    expect(tokens).toHaveLength(0);
  });
});
