// convex/access.ts
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

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

/** Require operator role. */
export async function requireOperator(ctx: AnyCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "operator") throw new ConvexError("Operator role required.");
  return user;
}

/** Require creator (operators pass too). */
export async function requireCreator(ctx: AnyCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "creator" && user.role !== "operator") {
    throw new ConvexError("Creator role required.");
  }
  return user;
}
