// convex/auth.ts
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import createOrUpdateUser from "./authGate";
import { PasswordResetCode } from "./passwordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // —— Password with GATED profile() (a thrown ConvexError reaches the client) ——
    Password<DataModel>({
      // "Forgot your password?" — emails a reset code (needs AUTH_RESEND_KEY).
      reset: PasswordResetCode,
      profile(params, _ctx) {
        const email = (params.email as string)?.toLowerCase().trim();
        if (!email) throw new ConvexError("Email is required.");
        return {
          email,
          name: (params.name as string) ?? undefined,
          // Pass the signup token through to createOrUpdateUser (authGate step 3).
          token: (params.token as string) ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Static import (was dynamic) — Convex functions do not support dynamic imports.
      return createOrUpdateUser(ctx, args);
    },
  },
});
