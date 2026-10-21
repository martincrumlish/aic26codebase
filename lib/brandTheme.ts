// lib/brandTheme.ts — turns what an admin set in Admin > Branding into the
// brand the pages use, falling back to the code defaults for anything unset:
// name and description from lib/site.ts, images from public/brand/, colours
// from the YOUR BRAND block in app/globals.css.
//
// Pure functions (no I/O), shared by the server (lib/brand.server.ts) and the
// branding form's live preview.
import { siteConfig } from "@/lib/site";

/** What convex/branding.ts `get` returns: null = not set, use the default. */
export type BrandOverrides = {
  name: string | null;
  description: string | null;
  brandColor: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
  artworkUrl: string | null;
};

export type Brand = {
  name: string;
  description: string;
  /** Sidebar and public-page header logo. */
  logoUrl: string;
  /** The larger logo on the sign-in panel. */
  logoLargeUrl: string;
  /** Artwork behind the sign-in panel and the landing hero (null = just the brand colour). */
  artworkUrl: string | null;
  /** CSS overriding the colour tokens ("" if no colours were set). */
  css: string;
};

export const DEFAULT_BRAND: Brand = {
  name: siteConfig.name,
  description: siteConfig.description,
  logoUrl: "/brand/small-transparent.png",
  logoLargeUrl: "/brand/mid-transparent.png",
  artworkUrl: "/brand/auth-bg.png",
  css: "",
};

/**
 * The default colours as hex, for the branding form's colour pickers. Keep in
 * step with --sidebar and --primary in app/globals.css.
 */
export const DEFAULT_COLORS = { brand: "#070d24", primary: "#0057c5" };

const HEX = /^#[0-9a-f]{6}$/i;
const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#0b1220";

export const isHexColor = (value: string) => HEX.test(value);

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whichever of light or dark text is easier to read on `hex`. */
export function readableTextOn(hex: string) {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance(DARK_TEXT) + 0.05);
  return onWhite >= onDark ? LIGHT_TEXT : DARK_TEXT;
}

/**
 * CSS for the colours an admin chose. It goes into a <style> tag, so only
 * validated #rrggbb values are ever written into it.
 */
export function brandCss({ brandColor, primaryColor }: Pick<BrandOverrides, "brandColor" | "primaryColor">) {
  const vars: string[] = [];
  if (brandColor && isHexColor(brandColor)) {
    const fg = readableTextOn(brandColor);
    vars.push(
      `--sidebar:${brandColor}`,
      `--sidebar-foreground:${fg}`,
      `--sidebar-accent:color-mix(in oklab,${brandColor},${fg} 16%)`,
      `--sidebar-accent-foreground:${fg}`,
      `--sidebar-primary-foreground:${fg}`,
      `--sidebar-border:color-mix(in oklab,${fg} 14%,transparent)`,
    );
  }
  if (primaryColor && isHexColor(primaryColor)) {
    vars.push(
      `--primary:${primaryColor}`,
      `--primary-foreground:${readableTextOn(primaryColor)}`,
      `--ring:${primaryColor}`,
      `--sidebar-primary:${primaryColor}`,
      `--sidebar-ring:${primaryColor}`,
    );
  }
  // html:root / html.dark outrank the :root and .dark rules in globals.css.
  return vars.length ? `html:root,html.dark{${vars.join(";")}}` : "";
}

export function resolveBrand(overrides: BrandOverrides | null): Brand {
  if (!overrides) return DEFAULT_BRAND;
  return {
    name: overrides.name ?? DEFAULT_BRAND.name,
    description: overrides.description ?? DEFAULT_BRAND.description,
    logoUrl: overrides.logoUrl ?? DEFAULT_BRAND.logoUrl,
    logoLargeUrl: overrides.logoUrl ?? DEFAULT_BRAND.logoLargeUrl,
    // The default artwork is drawn for the default navy: with your own brand
    // colour it's dropped (just the colour shows) unless you upload artwork.
    artworkUrl: overrides.artworkUrl ?? (overrides.brandColor ? null : DEFAULT_BRAND.artworkUrl),
    css: brandCss(overrides),
  };
}
