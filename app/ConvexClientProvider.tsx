// app/ConvexClientProvider.tsx
"use client";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  // Keep using the sign-in token the page loaded with until it's close to
  // expiring (Convex still refreshes it in time). Without this, every page
  // load fetches a second token straight away, which costs a round trip and
  // makes the server re-run every query on the page. Marked experimental by
  // Convex; if it's removed in a future version, deleting this line is safe.
  initialAuthTokenReuse: true,
});

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
