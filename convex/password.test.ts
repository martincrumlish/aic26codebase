// convex/password.test.ts
// Tests for the changePassword action.
//
// Limitation note: @convex-dev/auth's retrieveAccount and
// modifyAccountCredentials call internal auth mutations that rely on the
// full auth machinery (password hashing, authAccounts table writes).
// convex-test stubs those internals, so end-to-end "old password rejected /
// new password accepted" cannot be asserted here without a live Convex
// deployment. Instead we test:
//   A. Unauthenticated call → "Not signed in."
//   B. Authenticated user with no email → "No email address on account."
//   C. retrieveAccount rejection (wrong password) → "Current password is incorrect."
//
// The library call path (retrieveAccount → throws → we rethrow as
// ConvexError("Current password is incorrect.")) is covered by (C).
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

describe("password.changePassword", () => {
  test("A: rejects unauthenticated callers with 'Not signed in.'", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.password.changePassword, {
        currentPassword: "old",
        newPassword: "new",
      }),
    ).rejects.toThrow(/Not signed in/);
  });

  test("B: rejects authenticated user with no email", async () => {
    const t = convexTest(schema, modules);
    // Insert a user without an email field.
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        role: "creator",
        status: "active",
        createdVia: "seed",
        createdAt: Date.now(),
        // no email
      }),
    );
    await expect(
      t.withIdentity({ subject: userId }).action(api.password.changePassword, {
        currentPassword: "old",
        newPassword: "newpassword",
      }),
    ).rejects.toThrow(/No email address on account/);
  });

  test("D: rejects a too-short new password before verifying the current one", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "user@example.com",
        role: "creator",
        status: "active",
        createdVia: "seed",
        createdAt: Date.now(),
      }),
    );
    await expect(
      t.withIdentity({ subject: userId }).action(api.password.changePassword, {
        currentPassword: "whatever",
        newPassword: "short",
      }),
    ).rejects.toThrow(/at least 8 characters/i);
  });

  test("C: wrong current password → 'Current password is incorrect.'", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "user@example.com",
        role: "creator",
        status: "active",
        createdVia: "seed",
        createdAt: Date.now(),
      }),
    );
    // retrieveAccount will throw (no authAccounts row exists for this user in
    // the test DB), which our handler catches and re-throws as the user-facing
    // error message.
    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.password.changePassword, {
          currentPassword: "wrong",
          newPassword: "newpassword",
        }),
    ).rejects.toThrow(/Current password is incorrect/);
  });
});
