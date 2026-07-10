"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import {
  LayoutDashboardIcon,
  ShieldIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AccountMenu } from "@/components/app-shell/AccountMenu";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboardIcon;
  operatorOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboardIcon },
  // Settings now lives in the Account menu (bottom-left), not the main nav.
  { href: "/admin", label: "Admin", Icon: ShieldIcon, operatorOnly: true },
];

/**
 * Authenticated app shell: branded sidebar (logo + nav + user footer) wrapping
 * the page content. Applied to every route under app/(app); the full-screen
 * editor/viewer routes live outside the group and render no shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const me = useQuery(api.users.currentUser, {});
  const isOperator = me?.role === "operator";
  const items = NAV.filter((n) => !n.operatorOnly || isOperator);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        {/* Brand — logo spans the available width, horizontally centred */}
        <Link
          href="/dashboard"
          className="flex items-center justify-center px-4 py-5 transition-opacity hover:opacity-90"
        >
          <Image
            src="/brand/small-transparent.png"
            alt="App logo"
            width={300}
            height={63}
            priority
            className="h-auto w-full"
          />
        </Link>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Account menu footer */}
        <div className="border-t border-white/10 p-2">
          {me?.email && (
            <AccountMenu email={me.email} name={me.name ?? null} />
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
