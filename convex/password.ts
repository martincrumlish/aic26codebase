// convex/password.ts
// Convex action: change the current user's password.
//   1. Resolves the signed-in user and their email.
//   2. Verifies the current password via retrieveAccount (throws on mismatch).
//   3. Stores the new password via modifyAccountCredentials.
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  getAuthUserId,
  retrieveAccount,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Minimum length for a new password (mirrored client-side in SecurityForm).
const MIN_NEW_PASSWORD_LENGTH = 8;

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Require an authenticated session.
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not signed in.");

    // 1b. Validate the new password format before touching the account.
    if (args.newPassword.length < MIN_NEW_PASSWORD_LENGTH) {
      throw new ConvexError(
        `New password must be at least ${MIN_NEW_PASSWORD_LENGTH} characters.`,
      );
    }

    // 2. Fetch the user's email (actions have no ctx.db; use internal query).
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    const email = user?.email;
    if (!email) throw new ConvexError("No email address on account.");

    // 3. Verify the current password.
    //    retrieveAccount throws a ConvexError when the secret doesn't match.
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: email, secret: args.currentPassword },
      });
    } catch {
      // Always surface a consistent message so we don't leak info.
      throw new ConvexError("Current password is incorrect.");
    }

    // 4. Persist the new password (hashed by the Password provider's crypto).
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });

    return null;
  },
});
