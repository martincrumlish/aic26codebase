/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as authGate from "../authGate.js";
import type * as billing from "../billing.js";
import type * as branding from "../branding.js";
import type * as chat from "../chat.js";
import type * as email from "../email.js";
import type * as google from "../google.js";
import type * as http from "../http.js";
import type * as lib_aiKey from "../lib/aiKey.js";
import type * as lib_aiModels from "../lib/aiModels.js";
import type * as lib_aiUsage from "../lib/aiUsage.js";
import type * as lib_authMessages from "../lib/authMessages.js";
import type * as lib_emailCode from "../lib/emailCode.js";
import type * as lib_googleConnect from "../lib/googleConnect.js";
import type * as lib_plan from "../lib/plan.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_resend from "../lib/resend.js";
import type * as lib_signupMode from "../lib/signupMode.js";
import type * as lib_stripeConfig from "../lib/stripeConfig.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as password from "../password.js";
import type * as passwordReset from "../passwordReset.js";
import type * as projects from "../projects.js";
import type * as provisionHttp from "../provisionHttp.js";
import type * as provisioning from "../provisioning.js";
import type * as seed from "../seed.js";
import type * as signup from "../signup.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  admin: typeof admin;
  ai: typeof ai;
  auth: typeof auth;
  authGate: typeof authGate;
  billing: typeof billing;
  branding: typeof branding;
  chat: typeof chat;
  email: typeof email;
  google: typeof google;
  http: typeof http;
  "lib/aiKey": typeof lib_aiKey;
  "lib/aiModels": typeof lib_aiModels;
  "lib/aiUsage": typeof lib_aiUsage;
  "lib/authMessages": typeof lib_authMessages;
  "lib/emailCode": typeof lib_emailCode;
  "lib/googleConnect": typeof lib_googleConnect;
  "lib/plan": typeof lib_plan;
  "lib/plans": typeof lib_plans;
  "lib/resend": typeof lib_resend;
  "lib/signupMode": typeof lib_signupMode;
  "lib/stripeConfig": typeof lib_stripeConfig;
  "lib/tokens": typeof lib_tokens;
  password: typeof password;
  passwordReset: typeof passwordReset;
  projects: typeof projects;
  provisionHttp: typeof provisionHttp;
  provisioning: typeof provisioning;
  seed: typeof seed;
  signup: typeof signup;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
};
