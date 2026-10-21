// convex/access.ts
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getPlan } from "./lib/plan";

type AnyCtx = QueryCtx | MutationCtx;

/** Authenticated user id or throw. */
export async function requireUserId(ctx: AnyCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not signed in.");
  return userId;
}

/** Full profile (role/status) or throw; rejects revoked. */
export async function requireUser(ctx: AnyCtx): Promise<Doc<"users">> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("User profile missing.");
  if (user.status === "revoked") throw new ConvexError("Account revoked.");
  return user;
}

/** Require a paid (Pro) plan. Use for features you charge for. */
export async function requirePro(ctx: AnyCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if ((await getPlan(ctx, user._id)) !== "pro") {
    throw new ConvexError("This needs the Pro plan. Upgrade from the Pricing page.");
  }
  return user;
}

/** Require admin role. */
export async function requireAdmin(ctx: AnyCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw new ConvexError("Admin role required.");
  return user;
}
