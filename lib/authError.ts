// lib/authError.ts — the user-facing message in an error from a sign-in,
// sign-up, reset or confirmation call.
//
// The server's messages (convex/lib/authMessages.ts) are ConvexErrors. Called
// directly they arrive as ConvexError, but these auth calls go through the
// Next.js /api/auth route, which passes only the raw text on, as a plain Error:
//   "[Request ID: …] Server Error\nUncaught ConvexError: Invalid email or password."
// Anything else (library internals, network errors) returns null, so callers
// show their own fallback and never leak details.
import { ConvexError } from "convex/values";

const PROXIED = /ConvexError: ([^\n]+)/;

export function authErrorMessage(err: unknown): string | null {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : null;
  if (err instanceof Error) {
    const match = err.message.match(PROXIED);
    return match ? match[1].trim() : null;
  }
  return null;
}
