// convex/projects.test.ts — the example feature: user-owned projects with an
// optional file attachment and a plan limit. Copy this file's patterns.
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  registerStripe,
  sendStripeEvent,
  stubStripeApi,
  stubStripeEnv,
  subscriptionObject,
} from "../vitest/stripe";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;

function setupT() {
  const t = convexTest(schema, modules);
  registerStripe(t);
  return t;
}

async function makeUser(t: T, email: string, role: "admin" | "user" = "user") {
  return t.run((ctx) =>
    ctx.db.insert("users", { email, role, status: "active", createdVia: "seed", createdAt: Date.now() }),
  );
}

async function makePro(t: T, userId: Id<"users">) {
  await t.run((ctx) => ctx.db.insert("billingAccounts", { userId, stripeCustomerId: "cus_p" }));
  await sendStripeEvent(t, "customer.subscription.created", subscriptionObject({ id: "sub_p", customer: "cus_p" }));
}

const page = { numItems: 20, cursor: null };

beforeEach(() => {
  stubStripeEnv();
  stubStripeApi();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("projects: ownership", () => {
  test("you see only your own projects, newest first", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    const ben = t.withIdentity({ subject: await makeUser(t, "ben@x.com") });

    await amy.mutation(api.projects.create, { name: "First" });
    await amy.mutation(api.projects.create, { name: "Second", description: "notes" });
    await ben.mutation(api.projects.create, { name: "Ben's" });

    const mine = await amy.query(api.projects.list, { paginationOpts: page });
    expect(mine.page.map((p) => p.name)).toEqual(["Second", "First"]);
  });

  test("another user's project looks exactly like one that doesn't exist", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    const ben = t.withIdentity({ subject: await makeUser(t, "ben@x.com") });
    const projectId = await amy.mutation(api.projects.create, { name: "Private" });

    // Reads return null (indistinguishable from a deleted project); writes throw.
    expect(await ben.query(api.projects.get, { projectId })).toBeNull();
    await expect(
      ben.mutation(api.projects.update, { projectId, name: "Hacked" }),
    ).rejects.toThrow(/project not found/i);
    await expect(ben.mutation(api.projects.remove, { projectId })).rejects.toThrow(/project not found/i);
    expect((await amy.query(api.projects.get, { projectId }))?.name).toBe("Private");
  });

  test("signed-out callers are rejected", async () => {
    const t = setupT();
    await expect(t.query(api.projects.list, { paginationOpts: page })).rejects.toThrow(/not signed in/i);
    await expect(t.mutation(api.projects.create, { name: "x" })).rejects.toThrow(/not signed in/i);
  });

  test("names are required and kept to a sensible length", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    await expect(amy.mutation(api.projects.create, { name: "   " })).rejects.toThrow(/needs a name/i);
    await expect(amy.mutation(api.projects.create, { name: "x".repeat(101) })).rejects.toThrow(/100 characters/i);
  });

  test("update changes your own project", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    const projectId = await amy.mutation(api.projects.create, { name: "Old" });
    await amy.mutation(api.projects.update, { projectId, name: "New", description: "Updated" });
    expect(await amy.query(api.projects.get, { projectId })).toMatchObject({
      name: "New", description: "Updated",
    });
  });
});

describe("projects: plan limits", () => {
  test("Free allows 3 projects, then explains how to get more", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    for (const n of [1, 2, 3]) await amy.mutation(api.projects.create, { name: `P${n}` });
    await expect(amy.mutation(api.projects.create, { name: "P4" })).rejects.toThrow(/upgrade to pro/i);
    expect(await amy.query(api.projects.usage, {})).toEqual({ count: 3, limit: 3, plan: "free" });
  });

  test("Pro has no limit", async () => {
    const t = setupT();
    const userId = await makeUser(t, "pro@x.com");
    await makePro(t, userId);
    const pro = t.withIdentity({ subject: userId });
    for (const n of [1, 2, 3, 4, 5]) await pro.mutation(api.projects.create, { name: `P${n}` });
    expect(await pro.query(api.projects.usage, {})).toEqual({ count: 5, limit: null, plan: "pro" });
  });
});

describe("projects: attachments (Convex file storage)", () => {
  async function upload(t: T, text: string) {
    return t.run((ctx) => ctx.storage.store(new Blob([text], { type: "text/plain" })));
  }

  test("attach a file, get a download URL, and replacing it deletes the old file", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    const projectId = await amy.mutation(api.projects.create, { name: "With file" });

    expect(await amy.mutation(api.projects.generateUploadUrl, {})).toMatch(/^https?:\/\//);

    const first = await upload(t, "first");
    await amy.mutation(api.projects.setAttachment, { projectId, storageId: first, fileName: "a.txt" });
    const got = await amy.query(api.projects.get, { projectId });
    expect(got?.attachment).toMatchObject({ name: "a.txt" });
    expect(got?.attachment?.url).toBeTruthy();

    const second = await upload(t, "second");
    await amy.mutation(api.projects.setAttachment, { projectId, storageId: second, fileName: "b.txt" });
    expect(await t.run((ctx) => ctx.storage.getUrl(first))).toBeNull();

    await amy.mutation(api.projects.removeAttachment, { projectId });
    expect(await t.run((ctx) => ctx.storage.getUrl(second))).toBeNull();
    expect((await amy.query(api.projects.get, { projectId }))?.attachment).toBeNull();
  });

  test("you can't attach a file to someone else's project", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    const ben = t.withIdentity({ subject: await makeUser(t, "ben@x.com") });
    const projectId = await amy.mutation(api.projects.create, { name: "Amy's" });
    const file = await upload(t, "x");
    await expect(
      ben.mutation(api.projects.setAttachment, { projectId, storageId: file, fileName: "x.txt" }),
    ).rejects.toThrow(/project not found/i);
  });

  // Not a thrown error: a mutation that throws is rolled back, which would
  // also undo deleting the oversized file.
  test("files over the size limit are refused and deleted", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    const projectId = await amy.mutation(api.projects.create, { name: "Big" });
    const big = await upload(t, "x".repeat(10 * 1024 * 1024 + 1));
    const result = await amy.mutation(api.projects.setAttachment, {
      projectId, storageId: big, fileName: "big.bin",
    });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/10 MB/i) });
    expect(await t.run((ctx) => ctx.storage.getUrl(big))).toBeNull();
    expect((await amy.query(api.projects.get, { projectId }))?.attachment).toBeNull();
  });

  test("deleting a project deletes its file", async () => {
    const t = setupT();
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    const projectId = await amy.mutation(api.projects.create, { name: "Doomed" });
    const file = await upload(t, "bye");
    await amy.mutation(api.projects.setAttachment, { projectId, storageId: file, fileName: "f.txt" });
    await amy.mutation(api.projects.remove, { projectId });
    expect(await t.run((ctx) => ctx.storage.getUrl(file))).toBeNull();
    expect(await amy.query(api.projects.get, { projectId })).toBeNull();
  });
});

describe("deleting a user", () => {
  test("removes their projects and files", async () => {
    const t = setupT();
    const adminId = await makeUser(t, "admin@x.com", "admin");
    const userId = await makeUser(t, "amy@x.com");
    const amy = t.withIdentity({ subject: userId });
    const projectId = await amy.mutation(api.projects.create, { name: "Gone soon" });
    const file = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await amy.mutation(api.projects.setAttachment, { projectId, storageId: file, fileName: "x.txt" });

    await t.withIdentity({ subject: adminId }).mutation(api.admin.deleteUserAccount, { userId });

    expect(await t.run((ctx) => ctx.db.get(projectId))).toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(file))).toBeNull();
  });
});
