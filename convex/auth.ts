// convex/auth.ts
import { Password } from "@convex-dev/auth/providers/Password";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import createOrUpdateUser from "./authGate";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // —— Password with GATED profile() (a thrown ConvexError reaches the client) ——
    Password<DataModel>({
      profile(params, _ctx) {
        const email = (params.email as string)?.toLowerCase().trim();
        if (!email) throw new ConvexError("Email is required.");
        return {
          email,
          name: (params.name as string) ?? undefined,
          // Pass the signup token through to createOrUpdateUser (authGate §3).
          token: (params.token as string) ?? undefined,
        };
      },
    }),
    // —— Magic-link via Resend. Default id "resend"; reads AUTH_RESEND_KEY. ——
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? "App <onboarding@resend.dev>",
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Static import (was dynamic) — Convex functions do not support dynamic imports.
      return createOrUpdateUser(ctx, args);
    },
  },
});
