// convex/branding.test.ts — Admin > Branding: name, colours, logo and sign-in
// artwork, stored once and shown on every page.
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;

async function makeUser(t: T, role: "admin" | "user") {
  return t.run((ctx) =>
    ctx.db.insert("users", { email: `${role}@x.com`, role, status: "active", createdVia: "seed", createdAt: Date.now() }),
  );
}

async function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({ subject: `${await makeUser(t, "admin")}|s` });
  const user = t.withIdentity({ subject: `${await makeUser(t, "user")}|s` });
  return { t, admin, user };
}

/**
 * Store a file as an upload would. Real Convex records the upload's
 * Content-Type; convex-test doesn't, so the test sets it on the file's
 * metadata itself.
 */
async function upload(t: T, bytes: number, type: string): Promise<Id<"_storage">> {
  return t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob([new Uint8Array(bytes)], { type }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (ctx.db as any).patch(id, { contentType: type });
    return id;
  });
}

const EMPTY = {
  name: null, description: null, brandColor: null, primaryColor: null, logoUrl: null, artworkUrl: null,
};

describe("branding.get", () => {
  test("anyone can read it, even signed out (public pages need it); nothing set by default", async () => {
    const { t } = await setup();
    expect(await t.query(api.branding.get, {})).toEqual(EMPTY);
  });
});

describe("branding.update", () => {
  test("admins set the name, description and colours; null puts a default back", async () => {
    const { admin, t } = await setup();
    await admin.mutation(api.branding.update, {
      name: "  Fieldnote ", description: "Notes for field teams.", brandColor: "#0F3D2E", primaryColor: "#16a34a",
    });
    expect(await t.query(api.branding.get, {})).toMatchObject({
      name: "Fieldnote", description: "Notes for field teams.", brandColor: "#0f3d2e", primaryColor: "#16a34a",
    });

    await admin.mutation(api.branding.update, { primaryColor: null });
    expect(await t.query(api.branding.get, {})).toMatchObject({ name: "Fieldnote", primaryColor: null });
  });

  test("rejects colours that aren't #rrggbb, and names that are empty or too long", async () => {
    const { admin } = await setup();
    await expect(admin.mutation(api.branding.update, { brandColor: "red" })).rejects.toThrow(/#rrggbb/i);
    await expect(admin.mutation(api.branding.update, { name: "   " })).rejects.toThrow(/name/i);
    await expect(admin.mutation(api.branding.update, { name: "x".repeat(61) })).rejects.toThrow(/60/);
  });

  test("only admins", async () => {
    const { user, t } = await setup();
    await expect(user.mutation(api.branding.update, { name: "Mine now" })).rejects.toThrow(/admin/i);
    await expect(t.mutation(api.branding.update, { name: "Anon" })).rejects.toThrow();
  });
});

describe("branding images", () => {
  test("upload a logo; replacing it deletes the old file", async () => {
    const { admin, t } = await setup();
    expect(await admin.mutation(api.branding.generateUploadUrl, {})).toMatch(/^https?:\/\//);

    const first = await upload(t, 1000, "image/png");
    expect(await admin.mutation(api.branding.setImage, { kind: "logo", storageId: first })).toEqual({ ok: true });
    expect((await t.query(api.branding.get, {})).logoUrl).toEqual(expect.any(String));

    const second = await upload(t, 1000, "image/svg+xml");
    await admin.mutation(api.branding.setImage, { kind: "logo", storageId: second });
    expect(await t.run((ctx) => ctx.storage.getUrl(first))).toBeNull();
  });

  test("refuses files that aren't images, or are too big, and deletes them", async () => {
    const { admin, t } = await setup();
    const pdf = await upload(t, 1000, "application/pdf");
    expect(await admin.mutation(api.branding.setImage, { kind: "logo", storageId: pdf })).toEqual({
      ok: false, error: expect.stringMatching(/png, jpeg, webp or svg/i),
    });
    expect(await t.run((ctx) => ctx.storage.getUrl(pdf))).toBeNull();

    const huge = await upload(t, 3 * 1024 * 1024, "image/png");
    expect(await admin.mutation(api.branding.setImage, { kind: "logo", storageId: huge })).toEqual({
      ok: false, error: expect.stringMatching(/1 MB/i),
    });
    expect(await t.run((ctx) => ctx.storage.getUrl(huge))).toBeNull();
    expect((await t.query(api.branding.get, {})).logoUrl).toBeNull();
  });

  test("remove an image, and reset everything (files are deleted)", async () => {
    const { admin, t } = await setup();
    const art = await upload(t, 1000, "image/jpeg");
    await admin.mutation(api.branding.setImage, { kind: "artwork", storageId: art });
    await admin.mutation(api.branding.removeImage, { kind: "artwork" });
    expect((await t.query(api.branding.get, {})).artworkUrl).toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(art))).toBeNull();

    const logo = await upload(t, 1000, "image/png");
    await admin.mutation(api.branding.setImage, { kind: "logo", storageId: logo });
    await admin.mutation(api.branding.update, { name: "Fieldnote", brandColor: "#0f3d2e" });
    await admin.mutation(api.branding.reset, {});
    expect(await t.query(api.branding.get, {})).toEqual(EMPTY);
    expect(await t.run((ctx) => ctx.storage.getUrl(logo))).toBeNull();
  });

  test("only admins can upload or reset", async () => {
    const { user, t } = await setup();
    const file = await upload(t, 10, "image/png");
    await expect(user.mutation(api.branding.generateUploadUrl, {})).rejects.toThrow(/admin/i);
    await expect(user.mutation(api.branding.setImage, { kind: "logo", storageId: file })).rejects.toThrow(/admin/i);
    await expect(user.mutation(api.branding.reset, {})).rejects.toThrow(/admin/i);
  });
});
