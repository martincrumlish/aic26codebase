"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { LayoutDashboardIcon, MenuIcon, ShieldIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AccountMenu } from "@/components/app-shell/AccountMenu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboardIcon;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboardIcon },
  // Settings lives in the Account menu (bottom-left), not the main nav.
  { href: "/admin", label: "Admin", Icon: ShieldIcon, adminOnly: true },
];

/** Logo + nav + account menu. Shared by the desktop sidebar and the phone menu. */
function SidebarBody({
  onNavigate,
  logoClassName,
}: {
  onNavigate?: () => void;
  logoClassName?: string;
}) {
  const pathname = usePathname();
  const me = useQuery(api.users.currentUser, {});
  const isAdmin = me?.role === "admin";
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-center px-4 py-5 transition-opacity hover:opacity-90",
          logoClassName,
        )}
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

      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-2">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
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

      <div className="border-t border-white/10 p-2">
        {me?.email && <AccountMenu email={me.email} name={me.name ?? null} />}
      </div>
    </>
  );
}

/**
 * Authenticated app shell, applied to every route under app/(app). From
 * tablet width up: a fixed sidebar. On phones: a top bar whose menu button
 * slides the same sidebar in from the left.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground md:flex-row">
      <header className="flex items-center justify-between bg-sidebar px-3 py-2 text-sidebar-foreground md:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-label="Open menu"
            className="rounded-md p-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <MenuIcon className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            {/* pr-12 keeps the logo clear of the sheet's close button. */}
            <SidebarBody onNavigate={() => setMenuOpen(false)} logoClassName="pr-12" />
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="h-7">
          <Image
            src="/brand/small-transparent.png"
            alt="App logo"
            width={300}
            height={63}
            className="h-7 w-auto"
          />
        </Link>
        {/* Spacer balances the menu button so the logo stays centred. */}
        <span className="w-9" aria-hidden="true" />
      </header>

      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBody />
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
