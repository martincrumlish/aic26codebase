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
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as authGate from "../authGate.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as operator from "../operator.js";
import type * as password from "../password.js";
import type * as provisionHttp from "../provisionHttp.js";
import type * as provisioning from "../provisioning.js";
import type * as seed from "../seed.js";
import type * as testSupport from "../testSupport.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  ai: typeof ai;
  auth: typeof auth;
  authGate: typeof authGate;
  email: typeof email;
  http: typeof http;
  operator: typeof operator;
  password: typeof password;
  provisionHttp: typeof provisionHttp;
  provisioning: typeof provisioning;
  seed: typeof seed;
  testSupport: typeof testSupport;
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

export declare const components: {};
