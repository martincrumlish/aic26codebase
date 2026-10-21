// lib/authError.test.ts
import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { authErrorMessage } from "./authError";

describe("authErrorMessage", () => {
  test("a ConvexError (calling Convex directly): its message", () => {
    expect(authErrorMessage(new ConvexError("Invalid email or password."))).toBe("Invalid email or password.");
  });

  test("through the Next.js /api/auth route, which passes the raw text on as a plain Error", () => {
    const proxied = new Error(
      "[Request ID: 183a873ea14bb01b] Server Error\nUncaught ConvexError: Invalid email or password.\n\n    at handler (../convex/auth.ts:85:12)",
    );
    expect(authErrorMessage(proxied)).toBe("Invalid email or password.");
  });

  test("anything else isn't meant for users: null (callers show their own fallback)", () => {
    expect(authErrorMessage(new Error("[Request ID: x] Server Error\nUncaught Error: InvalidAccountId"))).toBeNull();
    expect(authErrorMessage(new Error("Failed to fetch"))).toBeNull();
    expect(authErrorMessage("nope")).toBeNull();
    expect(authErrorMessage(new ConvexError({ code: 1 }))).toBeNull();
  });
});
