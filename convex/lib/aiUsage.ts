// convex/lib/aiUsage.ts — the monthly allowance for AI messages sent on the
// app's OpenRouter key (PLANS.<plan>.limits.appAiMessagesPerMonth), so one
// heavy user can't run up the owner's bill. Messages on a user's own key are
// never counted. Months are calendar months in UTC, so the count starts again
// on the 1st with no scheduled job.
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** "2026-10" for any time in October 2026 (UTC). */
export function currentPeriod(now: number) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** When the current period ends: midnight UTC on the 1st of next month. */
export function periodEnd(now: number) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

async function row(ctx: QueryCtx | MutationCtx, userId: Id<"users">, now: number) {
  return await ctx.db
    .query("aiUsage")
    .withIndex("by_user_period", (q) => q.eq("userId", userId).eq("period", currentPeriod(now)))
    .unique();
}

export async function messagesThisMonth(ctx: QueryCtx | MutationCtx, userId: Id<"users">, now = Date.now()) {
  return (await row(ctx, userId, now))?.messages ?? 0;
}

const formatDay = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/** Count one message on the app's key, or refuse if this month's allowance is used up. */
export async function countAppMessage(
  ctx: MutationCtx,
  userId: Id<"users">,
  limit: number,
  now = Date.now(),
) {
  const existing = await row(ctx, userId, now);
  const used = existing?.messages ?? 0;
  if (used >= limit) {
    throw new ConvexError(
      `You've used all ${limit.toLocaleString("en-US")} AI messages included this month. ` +
        `Add your own OpenRouter key in Settings to keep going, or wait until ${formatDay(periodEnd(now))}.`,
    );
  }
  if (existing) await ctx.db.patch(existing._id, { messages: used + 1 });
  else await ctx.db.insert("aiUsage", { userId, period: currentPeriod(now), messages: 1 });
}
