// convex/branding.ts — Admin > Branding: the app's name, description, brand
// and button colours, logo and sign-in artwork. One row; anything not set
// falls back to the defaults in code (lib/brandTheme.ts). The server reads
// this on every page (lib/brand.server.ts), so changes show everywhere.
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./access";

const HEX = /^#[0-9a-f]{6}$/i;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = { logo: 1024 * 1024, artwork: 4 * 1024 * 1024 } as const;

const Kind = v.union(v.literal("logo"), v.literal("artwork"));
const field = { logo: "logoId", artwork: "artworkId" } as const;

async function current(ctx: QueryCtx | MutationCtx) {
  return await ctx.db.query("branding").first();
}

async function upsert(
  ctx: MutationCtx,
  patch: Partial<{
    name: string | undefined;
    description: string | undefined;
    brandColor: string | undefined;
    primaryColor: string | undefined;
    logoId: Id<"_storage"> | undefined;
    artworkId: Id<"_storage"> | undefined;
  }>,
) {
  const row = await current(ctx);
  if (row) await ctx.db.patch(row._id, { ...patch, updatedAt: Date.now() });
  else await ctx.db.insert("branding", { ...patch, updatedAt: Date.now() });
}

/**
 * Public on purpose: signed-out pages (landing, pricing, sign-in) show the
 * brand. Returns only what those pages display anyway. null = not set.
 */
export const get = query({
  args: {},
  returns: v.object({
    name: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    brandColor: v.union(v.string(), v.null()),
    primaryColor: v.union(v.string(), v.null()),
    logoUrl: v.union(v.string(), v.null()),
    artworkUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const row = await current(ctx);
    return {
      name: row?.name ?? null,
      description: row?.description ?? null,
      brandColor: row?.brandColor ?? null,
      primaryColor: row?.primaryColor ?? null,
      logoUrl: row?.logoId ? await ctx.storage.getUrl(row.logoId) : null,
      artworkUrl: row?.artworkId ? await ctx.storage.getUrl(row.artworkId) : null,
    };
  },
});

const optionalText = v.optional(v.union(v.string(), v.null()));

/** Set any of the text and colour fields. Leave one out to keep it; null resets it. */
export const update = mutation({
  args: {
    name: optionalText,
    description: optionalText,
    brandColor: optionalText,
    primaryColor: optionalText,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const patch: Parameters<typeof upsert>[1] = {};

    if (args.name !== undefined) {
      const name = args.name?.trim();
      if (name === "") throw new ConvexError("The app needs a name.");
      if (name && name.length > 60) throw new ConvexError("Keep the name to 60 characters.");
      patch.name = name ?? undefined;
    }
    if (args.description !== undefined) {
      const description = args.description?.trim();
      if (description && description.length > 160) throw new ConvexError("Keep the description to 160 characters.");
      patch.description = description || undefined;
    }
    for (const key of ["brandColor", "primaryColor"] as const) {
      const value = args[key];
      if (value === undefined) continue;
      if (value !== null && !HEX.test(value.trim())) {
        throw new ConvexError("Colours must be written as #rrggbb, e.g. #1d4ed8.");
      }
      patch[key] = value?.trim().toLowerCase() ?? undefined;
    }

    await upsert(ctx, patch);
    return null;
  },
});

/** Step 1 of an image upload: a short-lived URL the browser POSTs the file to. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Step 2: use the uploaded file as the logo or artwork. A wrong type or a
 * too-big file is reported rather than thrown, because a mutation that throws
 * is rolled back, which would also undo deleting the rejected file.
 */
export const setImage = mutation({
  args: { kind: Kind, storageId: v.id("_storage") },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), error: v.string() })),
  handler: async (ctx, { kind, storageId }) => {
    await requireAdmin(ctx);
    const file = await ctx.db.system.get(storageId);
    if (!file) throw new ConvexError("Upload not found. Please try again.");
    const reject = async (error: string) => {
      await ctx.storage.delete(storageId);
      return { ok: false as const, error };
    };
    if (!IMAGE_TYPES.includes(file.contentType ?? "")) return await reject("Use a PNG, JPEG, WebP or SVG image.");
    if (file.size > MAX_BYTES[kind]) {
      return await reject(`Images for the ${kind} can be up to ${MAX_BYTES[kind] / 1024 / 1024} MB.`);
    }

    const row = await current(ctx);
    const previous = row?.[field[kind]];
    if (previous && previous !== storageId) await ctx.storage.delete(previous);
    await upsert(ctx, { [field[kind]]: storageId });
    return { ok: true as const };
  },
});

export const removeImage = mutation({
  args: { kind: Kind },
  returns: v.null(),
  handler: async (ctx, { kind }) => {
    await requireAdmin(ctx);
    const row = await current(ctx);
    const id = row?.[field[kind]];
    if (id) {
      await ctx.storage.delete(id);
      await upsert(ctx, { [field[kind]]: undefined });
    }
    return null;
  },
});

/** Back to the defaults in code: clears every field and deletes the images. */
export const reset = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await current(ctx);
    if (!row) return null;
    if (row.logoId) await ctx.storage.delete(row.logoId);
    if (row.artworkId) await ctx.storage.delete(row.artworkId);
    await ctx.db.delete(row._id);
    return null;
  },
});
