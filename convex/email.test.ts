// convex/email.test.ts — transactional email via Resend REST (fail-soft).
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

function makeUser(t: ReturnType<typeof convexTest>, role: "operator" | "creator" = "creator") {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      email: `${role}@x.com`, role, status: "active",
      createdVia: "seed", createdAt: Date.now(),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("email.send (internal action)", () => {
  test("returns {sent:false, reason:'no-key'} when AUTH_RESEND_KEY is unset — no fetch", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("AUTH_RESEND_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    const result = await t.action(internal.email.send, {
      to: "a@x.com", subject: "Hi", html: "<p>Hi</p>",
    });
    expect(result).toEqual({ sent: false, reason: "no-key" });
    expect(spy).not.toHaveBeenCalled();
  });

  test("posts to Resend with the key and configured from-address", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
    vi.stubEnv("AUTH_EMAIL_FROM", "App <hello@example.com>");
    const spy = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
    vi.stubGlobal("fetch", spy);

    const result = await t.action(internal.email.send, {
      to: "a@x.com", subject: "Hi", html: "<p>Hi</p>",
    });

    expect(result).toEqual({ sent: true, id: "email_1" });
    expect(spy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_123",
          "Content-Type": "application/json",
        }),
      }),
    );
    const body = JSON.parse((spy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({
      from: "App <hello@example.com>", to: ["a@x.com"], subject: "Hi", html: "<p>Hi</p>",
    });
  });

  test("fails soft on a Resend error response", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 422 })));

    const result = await t.action(internal.email.send, {
      to: "a@x.com", subject: "Hi", html: "<p>Hi</p>",
    });
    expect(result).toEqual({ sent: false, reason: "resend-422" });
  });

  test("fails soft when fetch itself throws", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));

    const result = await t.action(internal.email.send, {
      to: "a@x.com", subject: "Hi", html: "<p>Hi</p>",
    });
    expect(result).toEqual({ sent: false, reason: "network" });
  });
});

describe("email.emailEnabled", () => {
  test("reflects AUTH_RESEND_KEY presence; requires sign-in", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t);

    vi.stubEnv("AUTH_RESEND_KEY", "");
    await expect(t.query(api.email.emailEnabled, {})).rejects.toThrow(/not signed in/i);
    expect(await t.withIdentity({ subject: id }).query(api.email.emailEnabled, {})).toBe(false);

    vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
    expect(await t.withIdentity({ subject: id }).query(api.email.emailEnabled, {})).toBe(true);
  });
});

describe("email.sendCreatorInvite", () => {
  test("operator can email an invite link containing the join URL", async () => {
    const t = convexTest(schema, modules);
    const opId = await makeUser(t, "operator");
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    const spy = vi.fn(async () => new Response(JSON.stringify({ id: "email_2" }), { status: 200 }));
    vi.stubGlobal("fetch", spy);

    const result = await t.withIdentity({ subject: opId }).action(api.email.sendCreatorInvite, {
      email: "invitee@x.com", token: "tok-123",
    });

    expect(result).toEqual({ sent: true, id: "email_2" });
    const body = JSON.parse((spy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.to).toEqual(["invitee@x.com"]);
    expect(body.html).toContain("http://localhost:3000/join/tok-123");
  });

  test("non-operators are rejected", async () => {
    const t = convexTest(schema, modules);
    const id = await makeUser(t, "creator");
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_123");
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      t.withIdentity({ subject: id }).action(api.email.sendCreatorInvite, {
        email: "invitee@x.com", token: "tok-123",
      }),
    ).rejects.toThrow(/operator/i);
  });
});
