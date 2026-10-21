// components/settings/SettingsNav.tsx — the Settings menu: a column on the
// left from tablet width up, a row of tabs (scrolls sideways) on phones.
// To add a section: create app/(app)/settings/<name>/page.tsx and add it here.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/security", label: "Sign-in & security" },
  { href: "/settings/ai", label: "AI" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings"
      className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:w-48 md:shrink-0 md:flex-col md:border-b-0 md:px-0"
    >
      {SECTIONS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors md:rounded-lg md:border-b-0",
              active
                ? "border-foreground text-foreground md:bg-muted"
                : "border-transparent text-muted-foreground hover:text-foreground md:hover:bg-muted/60",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
