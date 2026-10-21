// convex/auth.ts
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { makeFunctionReference, type GenericActionCtx } from "convex/server";
import { ConvexError, type Value } from "convex/values";
import type { DataModel, Id } from "./_generated/dataModel";
import createOrUpdateUser from "./authGate";
import { PasswordResetCode } from "./passwordReset";
import {
  PASSWORD_TOO_SHORT,
  REVOKED,
  SIGNIN_REJECTED,
  SIGNUP_REJECTED,
} from "./lib/authMessages";

// —— Password with GATED profile() (a thrown ConvexError reaches the client) ——
const password = Password<DataModel>({
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
});

// Referenced by name (not via _generated/api) to avoid a circular import.
const userStatus = makeFunctionReference<
  "query",
  { userId: Id<"users"> },
  "active" | "revoked" | null
>("users:statusOf");

type Authorize = (
  params: Record<string, Value | undefined>,
  ctx: GenericActionCtx<DataModel>,
) => Promise<{ userId: Id<"users"> } | null>;

// Every password sign-in and sign-up runs through this wrapper. It adds two
// guarantees the library doesn't give on its own:
//  1. Failures never reveal whether an email has an account. The library's own
//     errors ("Account <email> already exists", "InvalidAccountId" vs
//     "InvalidSecret") become one fixed message per flow.
//  2. Revoked users can't get a session, even with the right password. The
//     library's sign-in flow never calls createOrUpdateUser, so authGate alone
//     can't stop it (and a sign-up with an existing account's correct password
//     is treated as a sign-in).
// Convex Auth reads `authorize` from the provider's `options` (it merges them
// over the provider when it loads it), so that's where the wrapper must go.
const base = password as unknown as { options: { authorize: Authorize } };
const guardedPassword = {
  ...password,
  options: {
    ...base.options,
    authorize: (async (params, ctx) => {
      let result: Awaited<ReturnType<Authorize>>;
      try {
        result = await base.options.authorize(params, ctx);
      } catch (err) {
        // A ConvexError is a deliberate, user-facing message (from authGate).
        if (err instanceof ConvexError) throw err;
        const message = err instanceof Error ? err.message : "";
        if (message === "Invalid password") throw new ConvexError(PASSWORD_TOO_SHORT);
        if (params.flow === "signUp") throw new ConvexError(SIGNUP_REJECTED);
        if (params.flow === "signIn") throw new ConvexError(SIGNIN_REJECTED);
        throw err; // reset flows: handled by the reset page (see ResetForm)
      }
      if (result) {
        const status = await ctx.runQuery(userStatus, { userId: result.userId });
        if (status === null) throw new ConvexError(SIGNIN_REJECTED);
        if (status === "revoked") throw new ConvexError(REVOKED);
      }
      return result;
    }) satisfies Authorize,
  },
} as typeof password;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [guardedPassword],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Static import (was dynamic) — Convex functions do not support dynamic imports.
      return createOrUpdateUser(ctx, args);
    },
  },
});
