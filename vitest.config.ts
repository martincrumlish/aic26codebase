// vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve the `@/*` path alias natively (no vite-tsconfig-paths plugin → pristine output).
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    projects: [
      {
        // Convex backend tests — convex-test needs the edge runtime.
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        // React / client / lib tests.
        extends: true,
        resolve: {
          alias: {
            "@": fileURLToPath(new URL(".", import.meta.url)),
            // Stub out Next.js server-only modules unavailable in jsdom.
            "server-only": fileURLToPath(
              new URL("./vitest/__mocks__/server-only.ts", import.meta.url),
            ),
            "next/server": fileURLToPath(
              new URL("./vitest/__mocks__/next-server.ts", import.meta.url),
            ),
          },
        },
        test: {
          name: "ui",
          globals: true,
          environment: "jsdom",
          include: [
            "app/**/*.test.{ts,tsx}",
            "components/**/*.test.{ts,tsx}",
            "lib/**/*.test.{ts,tsx}",
            "scripts/**/*.test.mjs",
            "middleware.test.ts",
          ],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
