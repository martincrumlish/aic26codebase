// components/landing/SiteChrome.tsx — the header and footer of the public
// pages (landing, pricing). They use the sidebar's colours (--sidebar and
// --sidebar-foreground in app/globals.css), so the whole brand changes together.
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
            className="rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/[0.06] hover:text-sidebar-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/signin"
            className="rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/[0.06] hover:text-sidebar-foreground"
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
    <footer className="border-t border-sidebar-foreground/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-sidebar-foreground/50 sm:px-6 lg:px-8">
        © {new Date().getFullYear()} {siteConfig.name}
      </div>
    </footer>
  );
}
