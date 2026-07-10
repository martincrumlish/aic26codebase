import { describe, it, expect } from "vitest";
import { securityHeaders } from "./headers";

describe("securityHeaders", () => {
  const blocks = securityHeaders();
  const embed = blocks.find((b) => b.source.includes("embed/"))!;
  const fallback = blocks.find((b) => b.source.startsWith("/((?!embed"))!;

  it("keeps /embed framable on any origin (no X-Frame-Options)", () => {
    const csp = embed.headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toMatch(/frame-ancestors \*/);
    expect(embed.headers.some((h) => h.key === "X-Frame-Options")).toBe(false);
  });

  it("locks every non-embed route to same-origin framing", () => {
    const csp = fallback.headers.find((h) => h.key === "Content-Security-Policy");
    const xfo = fallback.headers.find((h) => h.key === "X-Frame-Options");
    expect(csp?.value).toMatch(/frame-ancestors 'self'/);
    expect(xfo?.value).toBe("SAMEORIGIN");
  });

  it("the fallback source excludes embed paths and matches app routes", () => {
    // Sanity-check the negative-lookahead semantics the config relies on.
    const re = new RegExp(`^${fallback.source}$`);
    expect(re.test("/embed/tok_123")).toBe(false);
    expect(re.test("/dashboard")).toBe(true);
    expect(re.test("/m/tok_123")).toBe(true);
  });

  const header = (rule: typeof fallback, key: string) =>
    rule.headers.find((h) => h.key === key)?.value;

  it("adds the full hardening header set to non-embed routes (CR-016)", () => {
    expect(header(fallback, "Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(header(fallback, "X-Content-Type-Options")).toBe("nosniff");
    expect(header(fallback, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(header(fallback, "Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("adds framing-safe hardening headers to embeds but no restrictive frame/permissions policy (CR-016)", () => {
    expect(header(embed, "Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(header(embed, "X-Content-Type-Options")).toBe("nosniff");
    expect(header(embed, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    // Cross-origin framing must stay possible: no X-Frame-Options, permissive CSP.
    expect(embed.headers.some((h) => h.key === "X-Frame-Options")).toBe(false);
    expect(header(embed, "Content-Security-Policy")).toMatch(/frame-ancestors \*/);
    // Permissions-Policy deliberately omitted from embeds.
    expect(embed.headers.some((h) => h.key === "Permissions-Policy")).toBe(false);
  });
});
