// lib/brand.server.ts — the brand for the current request (server only):
// what an admin set in Admin > Branding, over the defaults in code.
//
// Read on every request (not baked in at build time), so a change in Admin >
// Branding shows on the next page load. cache() makes it one Convex read per
// request however many components ask.
import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { DEFAULT_BRAND, resolveBrand, type Brand } from "@/lib/brandTheme";

export const getBrand = cache(async (): Promise<Brand> => {
  await connection(); // render per request, so the brand is always current
  try {
    return resolveBrand(await fetchQuery(api.branding.get, {}));
  } catch (err) {
    // Never take the site down over branding: fall back to the defaults.
    console.error("Couldn't load branding; using the defaults.", err);
    return DEFAULT_BRAND;
  }
});
