// convex/projects.ts — THE EXAMPLE FEATURE. Copy and rename this to build your
// own (clients, documents, bookings...). It shows every pattern a real feature
// needs:
//
//   1. Every function starts with an access check (requireUser).
//   2. Every read or write of a project checks the owner, so nobody can touch
//      someone else's data by guessing an id. Someone else's project looks
//      exactly like a missing one: `get` returns null, writes throw
//      "Project not found".
//   3. Lists use an index + pagination, never a full-table scan.
//   4. Plan limits are checked on the server (lib/plans.ts + lib/plan.ts).
//   5. Files live in Convex storage: the browser uploads to a short-lived URL,
//      then we record the file. Replacing or deleting cleans up the old file.
//   6. Deleting a user deletes their projects and files (admin.ts cascade).
//
// Queries are reactive: the UI updates live when data changes, with no
// refetching code.
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./access";
import { getPlan } from "./lib/plan";
import { PLANS } from "./lib/plans";

const MAX_NAME = 100;
const MAX_DESCRIPTION = 2000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** For writes: the caller's own project, or "Project not found" (never "not yours"). */
async function ownProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">) {
  const user = await requireUser(ctx);
  const project = await ctx.db.get(projectId);
  if (!project || project.ownerId !== user._id) throw new ConvexError("Project not found.");
  return project;
}

function cleanName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new ConvexError("A project needs a name.");
  if (trimmed.length > MAX_NAME) throw new ConvexError(`Keep the name under ${MAX_NAME} characters.`);
  return trimmed;
}

function cleanDescription(description: string | undefined) {
  const trimmed = description?.trim();
  if (trimmed && trimmed.length > MAX_DESCRIPTION) {
    throw new ConvexError(`Keep the description under ${MAX_DESCRIPTION} characters.`);
  }
  return trimmed || undefined;
}

function limitFor(plan: keyof typeof PLANS) {
  const limit = PLANS[plan].limits.projects;
  return Number.isFinite(limit) ? limit : null;
}

const ProjectSummary = v.object({
  _id: v.id("projects"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  hasAttachment: v.boolean(),
  updatedAt: v.number(),
});

function summary(p: Doc<"projects">) {
  return {
    _id: p._id,
    _creationTime: p._creationTime,
    name: p.name,
    description: p.description,
    hasAttachment: p.attachmentId !== undefined,
    updatedAt: p.updatedAt,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(ProjectSummary),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const result = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(summary) };
  },
});

/**
 * One of your projects, or null if it doesn't exist or isn't yours. Returning
 * null (rather than throwing) lets the page show "not found" itself, and
 * means a live query doesn't error the moment the project is deleted.
 */
export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      name: v.string(),
      description: v.optional(v.string()),
      updatedAt: v.number(),
      attachment: v.union(v.object({ name: v.string(), url: v.union(v.string(), v.null()) }), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const p = await ctx.db.get(args.projectId);
    if (!p || p.ownerId !== user._id) return null;
    return {
      _id: p._id,
      name: p.name,
      description: p.description,
      updatedAt: p.updatedAt,
      attachment: p.attachmentId
        ? { name: p.attachmentName ?? "attachment", url: await ctx.storage.getUrl(p.attachmentId) }
        : null,
    };
  },
});

/** How many projects you have and your plan's limit (null = unlimited). */
export const usage = query({
  args: {},
  returns: v.object({
    count: v.number(),
    limit: v.union(v.number(), v.null()),
    plan: v.union(v.literal("free"), v.literal("pro")),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const plan = await getPlan(ctx, user._id);
    const limit = limitFor(plan);
    // Count up to the limit (+1) rather than reading every row.
    const rows = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .take(limit === null ? 1000 : limit + 1);
    return { count: rows.length, limit, plan };
  },
});

// ── Writes ───────────────────────────────────────────────────────────────────

export const create = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = cleanName(args.name);
    const limit = limitFor(await getPlan(ctx, user._id));
    if (limit !== null) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .take(limit);
      if (existing.length >= limit) {
        throw new ConvexError(
          `The Free plan includes ${limit} projects. Upgrade to Pro for unlimited projects.`,
        );
      }
    }
    return await ctx.db.insert("projects", {
      ownerId: user._id,
      name,
      description: cleanDescription(args.description),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { projectId: v.id("projects"), name: v.string(), description: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownProject(ctx, args.projectId);
    await ctx.db.patch(args.projectId, {
      name: cleanName(args.name),
      description: cleanDescription(args.description),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const p = await ownProject(ctx, args.projectId);
    if (p.attachmentId) await ctx.storage.delete(p.attachmentId);
    await ctx.db.delete(args.projectId);
    return null;
  },
});

// ── Attachments ──────────────────────────────────────────────────────────────

/** Step 1 of an upload: a short-lived URL the browser POSTs the file to. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Step 2: record the uploaded file on the project (checks owner and size).
 * A too-big file is reported in the result rather than thrown: a mutation that
 * throws is rolled back, which would also undo deleting the rejected file.
 */
export const setAttachment = mutation({
  args: { projectId: v.id("projects"), storageId: v.id("_storage"), fileName: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), error: v.string() })),
  handler: async (ctx, args) => {
    const p = await ownProject(ctx, args.projectId);
    const file = await ctx.db.system.get(args.storageId);
    if (!file) throw new ConvexError("Upload not found. Please try again.");
    if (file.size > MAX_FILE_BYTES) {
      await ctx.storage.delete(args.storageId);
      return { ok: false as const, error: "Files can be up to 10 MB." };
    }
    if (p.attachmentId) await ctx.storage.delete(p.attachmentId);
    await ctx.db.patch(args.projectId, {
      attachmentId: args.storageId,
      attachmentName: args.fileName.slice(0, 200),
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const removeAttachment = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const p = await ownProject(ctx, args.projectId);
    if (p.attachmentId) await ctx.storage.delete(p.attachmentId);
    await ctx.db.patch(args.projectId, {
      attachmentId: undefined,
      attachmentName: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});
