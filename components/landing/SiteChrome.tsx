// components/landing/SiteChrome.tsx — the header and footer of the public
// pages (landing, pricing). Navy like the app's sidebar, with the white logo.
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="relative z-10">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <Image
            src="/brand/small-transparent.png"
            alt={siteConfig.name}
            width={300}
            height={63}
            priority
            className="h-7 w-auto"
          />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1">
          <Link
            href="/pricing"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Pricing
          </Link>
          <Link
            href="/signin"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-white/50 sm:px-6 lg:px-8">
        © {new Date().getFullYear()} {siteConfig.name}
      </div>
    </footer>
  );
}
