// lib/brandTheme.test.ts
import { describe, expect, test } from "vitest";
import { siteConfig } from "@/lib/site";
import { DEFAULT_BRAND, brandCss, readableTextOn, resolveBrand } from "./brandTheme";

describe("readableTextOn", () => {
  test("light text on dark colours, dark text on light ones", () => {
    expect(readableTextOn("#070d24")).toBe("#ffffff");
    expect(readableTextOn("#1d4ed8")).toBe("#ffffff");
    expect(readableTextOn("#f4f6fb")).toBe("#0b1220");
    expect(readableTextOn("#facc15")).toBe("#0b1220");
  });
});

describe("brandCss", () => {
  test("nothing overridden: no CSS (the defaults in globals.css apply)", () => {
    expect(brandCss({ brandColor: null, primaryColor: null })).toBe("");
  });

  test("a brand colour sets the sidebar tokens with readable text, in light and dark mode", () => {
    const css = brandCss({ brandColor: "#f4f6fb", primaryColor: null });
    expect(css).toMatch(/^html:root,html\.dark\{/);
    expect(css).toContain("--sidebar:#f4f6fb");
    expect(css).toContain("--sidebar-foreground:#0b1220");
    expect(css).not.toContain("--primary:");
  });

  test("a button colour sets primary, its text and the focus ring", () => {
    const css = brandCss({ brandColor: null, primaryColor: "#15803d" });
    expect(css).toContain("--primary:#15803d");
    expect(css).toContain("--primary-foreground:#ffffff");
    expect(css).toContain("--ring:#15803d");
    // A brighter green reads better with dark text (5.9:1 vs 3.2:1 for white).
    expect(brandCss({ brandColor: null, primaryColor: "#16a34a" })).toContain("--primary-foreground:#0b1220");
  });

  test("never emits anything that isn't a plain hex colour (it goes into a <style> tag)", () => {
    const css = brandCss({ brandColor: "red;}body{display:none", primaryColor: "#12345" });
    expect(css).toBe("");
  });
});

describe("resolveBrand", () => {
  test("falls back to the code defaults", () => {
    const brand = resolveBrand(null);
    expect(brand).toEqual(DEFAULT_BRAND);
    expect(brand.name).toBe(siteConfig.name);
    expect(brand.logoUrl).toBe("/brand/small-transparent.png");
    expect(brand.css).toBe("");
  });

  test("uses what an admin set; an uploaded logo replaces both logo sizes", () => {
    const brand = resolveBrand({
      name: "Fieldnote",
      description: null,
      brandColor: "#0f3d2e",
      primaryColor: null,
      logoUrl: "https://x.convex.cloud/api/storage/logo",
      artworkUrl: null,
    });
    expect(brand.name).toBe("Fieldnote");
    expect(brand.description).toBe(siteConfig.description);
    expect(brand.logoUrl).toBe("https://x.convex.cloud/api/storage/logo");
    expect(brand.logoLargeUrl).toBe("https://x.convex.cloud/api/storage/logo");
    expect(brand.css).toContain("--sidebar:#0f3d2e");
  });

  test("the default artwork is drawn for the default navy, so a custom brand colour drops it", () => {
    const base = { name: null, description: null, primaryColor: null, logoUrl: null };
    expect(resolveBrand({ ...base, brandColor: null, artworkUrl: null }).artworkUrl).toBe(DEFAULT_BRAND.artworkUrl);
    expect(resolveBrand({ ...base, brandColor: "#eef3ec", artworkUrl: null }).artworkUrl).toBeNull();
    // ...unless they uploaded their own.
    expect(resolveBrand({ ...base, brandColor: "#eef3ec", artworkUrl: "https://x/art.png" }).artworkUrl).toBe(
      "https://x/art.png",
    );
  });
});
