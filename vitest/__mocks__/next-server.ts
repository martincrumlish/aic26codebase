// Minimal stub for "next/server" used in vitest jsdom tests.
// Only the symbols needed by @convex-dev/auth/nextjs/server are provided.
export class NextResponse {
  static redirect(_url: string | URL) {
    return new NextResponse();
  }
  static next() {
    return new NextResponse();
  }
}
export class NextRequest extends Request {}
export type NextFetchEvent = Record<string, unknown>;
export type NextMiddleware = unknown;
export type NextMiddlewareResult = unknown;
