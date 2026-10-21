// convex/lib/tokens.ts
import type { Doc } from "../_generated/dataModel";

/** Can this signup/activation token still be used right now? */
export function tokenIsUsable(tok: Doc<"provisioningTokens">, now = Date.now()) {
  return (
    !tok.revoked &&
    (tok.expiresAt === undefined || tok.expiresAt > now) &&
    (tok.maxUses === undefined || tok.usedCount < tok.maxUses)
  );
}
