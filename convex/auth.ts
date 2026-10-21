// convex/auth.ts
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { makeFunctionReference, type GenericActionCtx } from "convex/server";
import { ConvexError, v, type Value } from "convex/values";
import type { DataModel, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import createOrUpdateUser from "./authGate";
import { connectGoogleIfSignedIn } from "./lib/googleConnect";
import { PasswordResetCode } from "./passwordReset";
import { EmailConfirmationCode } from "./lib/emailCode";
import {
  CODE_INVALID,
  PASSWORD_TOO_SHORT,
  REVOKED,
  SIGNIN_REJECTED,
  SIGNUP_REJECTED,
} from "./lib/authMessages";

// —— Password with GATED profile() (a thrown ConvexError reaches the client) ——
const passwordConfig = {
  // "Forgot your password?" — emails a reset code (needs AUTH_RESEND_KEY).
  reset: PasswordResetCode,
  profile(params: Record<string, Value | undefined>) {
    const email = (params.email as string)?.toLowerCase().trim();
    if (!email) throw new ConvexError("Email is required.");
    return {
      email,
      name: (params.name as string) ?? undefined,
      // Pass the signup token through to createOrUpdateUser (authGate step 3).
      token: (params.token as string) ?? undefined,
    };
  },
};

// Two otherwise-identical providers: one makes people confirm their email with
// a code before they get a session, one doesn't. The wrapper below picks per
// request, so email confirmation switches on as soon as AUTH_RESEND_KEY is set
// (no redeploy) and never blocks sign-in on an app without email.
const plainPassword = Password<DataModel>(passwordConfig);
const password = Password<DataModel>({ ...passwordConfig, verify: EmailConfirmationCode });

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

// Every password sign-in and sign-up runs through this wrapper. It picks the
// email-confirming provider when email is set up, and adds two guarantees the
// library doesn't give on its own:
//  1. Failures never reveal whether an email has an account. The library's own
//     errors ("Account <email> already exists", "InvalidAccountId" vs
//     "InvalidSecret") become one fixed message per flow.
//  2. Revoked users can't get a session, even with the right password. The
//     library's sign-in flow never calls createOrUpdateUser, so authGate alone
//     can't stop it (and a sign-up with an existing account's correct password
//     is treated as a sign-in).
// Convex Auth reads `authorize` from the provider's `options` (it merges them
// over the provider when it loads it), so that's where the wrapper must go.
const optionsOf = (p: typeof password) =>
  (p as unknown as { options: { authorize: Authorize } }).options;
const guardedPassword = {
  ...password,
  options: {
    // Registers the confirmation and reset providers either way.
    ...optionsOf(password),
    authorize: (async (params, ctx) => {
      const impl = process.env.AUTH_RESEND_KEY
        ? optionsOf(password).authorize
        : optionsOf(plainPassword).authorize;
      let result: Awaited<ReturnType<Authorize>>;
      try {
        result = await impl(params, ctx);
      } catch (err) {
        // A ConvexError is a deliberate, user-facing message (from authGate).
        if (err instanceof ConvexError) throw err;
        const message = err instanceof Error ? err.message : "";
        if (message === "Invalid password") throw new ConvexError(PASSWORD_TOO_SHORT);
        if (params.flow === "signUp") throw new ConvexError(SIGNUP_REJECTED);
        if (params.flow === "signIn") throw new ConvexError(SIGNIN_REJECTED);
        if (params.flow === "email-verification") throw new ConvexError(CODE_INVALID);
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

// "Continue with Google". Optional: it does nothing (and the button stays
// hidden) until AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set - run
// `npm run setup:google`. authGate.ts decides who may sign in this way.
const google = Google({
  // Pass Google's own "is this email verified" flag through to authGate.
  profile(p) {
    return { id: p.sub, name: p.name, email: p.email, image: p.picture, emailVerified: p.email_verified === true };
  },
});

const convexAuthFns = convexAuth({
  providers: [guardedPassword, google],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Static import (was dynamic) — Convex functions do not support dynamic imports.
      return createOrUpdateUser(ctx, args);
    },
  },
});

export const { auth, signIn, signOut, isAuthenticated } = convexAuthFns;

// Convex Auth's internal `store` step, with "Connect Google" in front of it.
// createOrUpdateUser isn't told who started a sign-in, but the pending sign-in
// is, so linking a signed-in user's Google account happens here (see
// lib/googleConnect.ts). Everything else goes straight to Convex Auth.
type StoreHandler = (ctx: MutationCtx, args: { args: Record<string, unknown> }) => Promise<unknown>;
const convexAuthStore = (convexAuthFns.store as unknown as { _handler: StoreHandler })._handler;

export const store = internalMutation({
  // Convex Auth validates the inner arguments itself, and its store has no
  // `returns` validator either (it returns a different shape per step).
  args: { args: v.any() },
  handler: async (ctx, args) => {
    await connectGoogleIfSignedIn(ctx, args.args);
    return await convexAuthStore(ctx, args);
  },
});
