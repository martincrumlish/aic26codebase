// Security response headers (consumed by next.config.ts `headers()`).
//
// `/embed/*` must stay iframable on any site (that's the product feature), so
// it gets a permissive `frame-ancestors *` and NO X-Frame-Options. Every other
// route is locked to same-origin framing to defend against clickjacking, via
// both a modern CSP `frame-ancestors 'self'` and the legacy X-Frame-Options.
export const FRAME_ANCESTORS_SELF = "frame-ancestors 'self';";
export const FRAME_ANCESTORS_ANY = "frame-ancestors *;";

// Non-framing hardening headers. These are safe on embedded routes too — they
// don't affect whether the page can be framed cross-origin.
//
// NOTE: We deliberately keep the CSP value limited to `frame-ancestors`. We do
// NOT add a content CSP (`default-src`/`script-src`): Next.js relies on inline
// bootstrap/hydration scripts and there's no nonce plumbing here, so a strict
// script-src would break hydration. Clickjacking is covered by frame-ancestors
// + X-Frame-Options; the headers below cover the remaining transport/sniffing/
// referrer/permissions surface.
const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";
const NOSNIFF = "nosniff";
const REFERRER_POLICY = "strict-origin-when-cross-origin";
const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=()";

export type HeaderRule = {
  source: string;
  headers: { key: string; value: string }[];
};

export function securityHeaders(): HeaderRule[] {
  return [
    {
      // Embeds: allow cross-origin framing. Listed first; the fallback below
      // excludes embed paths so only this rule sets a CSP for them.
      //
      // We add only framing-safe hardening headers (HSTS / nosniff / Referrer).
      // We intentionally OMIT Permissions-Policy here: an embedded map may want
      // fullscreen/other features, and a restrictive policy could break them.
      source: "/embed/:path*",
      headers: [
        { key: "Content-Security-Policy", value: FRAME_ANCESTORS_ANY },
        { key: "Strict-Transport-Security", value: HSTS_VALUE },
        { key: "X-Content-Type-Options", value: NOSNIFF },
        { key: "Referrer-Policy", value: REFERRER_POLICY },
      ],
    },
    {
      // All non-embed routes: same-origin framing only + full hardening set.
      source: "/((?!embed).*)",
      headers: [
        { key: "Content-Security-Policy", value: FRAME_ANCESTORS_SELF },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Strict-Transport-Security", value: HSTS_VALUE },
        { key: "X-Content-Type-Options", value: NOSNIFF },
        { key: "Referrer-Policy", value: REFERRER_POLICY },
        { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
      ],
    },
  ];
}
