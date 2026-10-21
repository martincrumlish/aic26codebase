// scripts/google-setup-core.test.mjs
import { describe, expect, test } from "vitest";
import { checkGoogleCredentials, googleRedirectUri } from "./google-setup-core.mjs";

describe("googleRedirectUri", () => {
  test("is the Convex site URL's Google callback, without a doubled slash", () => {
    expect(googleRedirectUri("https://happy-otter-123.convex.site")).toBe(
      "https://happy-otter-123.convex.site/api/auth/callback/google",
    );
    expect(googleRedirectUri("https://happy-otter-123.convex.site/")).toBe(
      "https://happy-otter-123.convex.site/api/auth/callback/google",
    );
  });
});

describe("checkGoogleCredentials", () => {
  const id = "1234567890-abc123.apps.googleusercontent.com";
  test("accepts a real-looking client ID and secret", () => {
    expect(checkGoogleCredentials({ clientId: id, clientSecret: "GOCSPX-abcdefghijklmnop" })).toBeNull();
  });
  test("catches the common paste mistakes", () => {
    expect(checkGoogleCredentials({ clientId: "", clientSecret: "x" })).toMatch(/client id/i);
    expect(checkGoogleCredentials({ clientId: "GOCSPX-abc", clientSecret: id })).toMatch(/swapped/i);
    expect(checkGoogleCredentials({ clientId: "my-project-id", clientSecret: "GOCSPX-abc" })).toMatch(
      /apps\.googleusercontent\.com/,
    );
    expect(checkGoogleCredentials({ clientId: id, clientSecret: "" })).toMatch(/client secret/i);
  });
});
