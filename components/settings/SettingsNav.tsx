// components/settings/SettingsNav.tsx — the Settings menu: a column on the
// left from tablet width up, a row of tabs (scrolls sideways) on phones.
// To add a section: create app/(app)/settings/<name>/page.tsx and add it here.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCardIcon, KeyRoundIcon, ShieldCheckIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/settings/profile", label: "Profile", Icon: UserIcon },
  { href: "/settings/billing", label: "Billing", Icon: CreditCardIcon },
  { href: "/settings/security", label: "Sign-in & security", Icon: ShieldCheckIcon },
  { href: "/settings/ai", label: "AI", Icon: KeyRoundIcon },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings"
      className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:w-52 md:shrink-0 md:flex-col md:self-start md:border-b-0 md:px-0"
    >
      {SECTIONS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors md:rounded-lg md:border-b-0 md:py-2",
              active
                ? "border-primary text-foreground md:bg-card md:shadow-xs md:ring-1 md:ring-border"
                : "border-transparent text-muted-foreground hover:text-foreground md:hover:bg-card/70",
            )}
          >
            <Icon className="hidden size-4 md:block" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
