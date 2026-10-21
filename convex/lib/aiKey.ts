// convex/lib/aiKey.ts — which OpenRouter key pays for a user's AI calls.
//
//   1. The user's own key (Settings > AI), if they've added one.
//   2. The app's OPENROUTER_API_KEY env var, if their plan includes it
//      (PLANS.<plan>.limits.appAiKey: Pro by default; set it on Free too if
//      you want everyone to get AI on you).
//   3. Otherwise AI is off for them.
//
// The returned key is the raw secret: only use this in server code, and never
// return it from a public function.
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getPlan } from "./plan";
import { PLANS } from "./plans";

export type ResolvedKey =
  | { key: string; source: "own"; last4: string }
  | { key: string; source: "app" }
  | { key: null; appKeyNeedsPro: boolean };

export async function resolveOpenRouterKey(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<ResolvedKey> {
  const own = await ctx.db
    .query("userApiKeys")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (own) return { key: own.key, source: "own", last4: own.last4 };

  const appKey = process.env.OPENROUTER_API_KEY;
  if (!appKey) return { key: null, appKeyNeedsPro: false };
  const plan = await getPlan(ctx, userId);
  if (PLANS[plan].limits.appAiKey) return { key: appKey, source: "app" };
  return { key: null, appKeyNeedsPro: PLANS.pro.limits.appAiKey };
}
