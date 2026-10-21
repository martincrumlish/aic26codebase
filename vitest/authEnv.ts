// vitest/authEnv.ts — lets convex-test run real Convex Auth sign-ins.
// Convex Auth signs session JWTs and reads SITE_URL (both set by `npm run
// setup` on real deployments); this stubs throwaway values for a test.
import { vi } from "vitest";

export async function stubAuthEnv() {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const b64 = btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n");
  vi.stubEnv("JWT_PRIVATE_KEY", `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`);
}
