// convex/provisionHttp.test.ts
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test_secret_value";

async function sign(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

beforeEach(() => {
  vi.stubEnv("PROVISION_WEBHOOK_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /provision", () => {
  test("rejects an invalid signature with 401 and creates no user", async () => {
    const t = convexTest(schema, modules);
    const body = JSON.stringify({
      externalId: "e1", source: "billing", type: "grant",
      email: "c@x.com", role: "creator",
    });
    const res = await t.fetch("/provision", {
      method: "POST",
      headers: { "x-app-signature": "deadbeef" },
      body,
    });
    expect(res.status).toBe(401);
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  test("accepts a valid signature, provisions, and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const body = JSON.stringify({
      externalId: "e2", source: "billing", type: "grant",
      email: "c@x.com", role: "creator",
    });
    const sig = await sign(SECRET, body);

    const res1 = await t.fetch("/provision", {
      method: "POST",
      headers: { "x-app-signature": sig },
      body,
    });
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.ok).toBe(true);
    expect(json1.deduped).toBe(false);

    const res2 = await t.fetch("/provision", {
      method: "POST",
      headers: { "x-app-signature": sig },
      body,
    });
    const json2 = await res2.json();
    expect(json2.deduped).toBe(true);

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
  });
});
