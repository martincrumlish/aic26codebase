"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { FolderIcon, LayoutDashboardIcon, MenuIcon, MessageSquareIcon, PaletteIcon, ShieldIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DEFAULT_BRAND } from "@/lib/brandTheme";
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
  { href: "/projects", label: "Projects", Icon: FolderIcon },
  { href: "/chat", label: "AI chat", Icon: MessageSquareIcon },
  // Settings lives in the Account menu (bottom-left), not the main nav.
  { href: "/admin", label: "Admin", Icon: ShieldIcon, adminOnly: true },
  { href: "/admin/branding", label: "Branding", Icon: PaletteIcon, adminOnly: true },
];

/** The nav item for the current page: the longest href that matches. */
function activeHref(pathname: string) {
  return NAV.map((n) => n.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

type Branding = { logoUrl: string; appName: string };

function Logo({ logoUrl, appName, className }: Branding & { className?: string }) {
  return (
    <Image
      src={logoUrl}
      alt={appName}
      width={300}
      height={63}
      priority
      // Uploaded logos come from Convex storage; serve them as they are.
      unoptimized={!logoUrl.startsWith("/")}
      className={className}
    />
  );
}

/** Logo + nav + account menu. Shared by the desktop sidebar and the phone menu. */
function SidebarBody({
  onNavigate,
  logoClassName,
  ...brand
}: Branding & {
  onNavigate?: () => void;
  logoClassName?: string;
}) {
  const pathname = usePathname();
  const me = useQuery(api.users.currentUser, {});
  const isAdmin = me?.role === "admin";
  const main = NAV.filter((n) => !n.adminOnly);
  const admin = isAdmin ? NAV.filter((n) => n.adminOnly) : [];
  const current = activeHref(pathname);

  const link = ({ href, label, Icon }: NavItem) => {
    const active = href === current;
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.08)]"
            : "text-sidebar-foreground/65 hover:bg-sidebar-foreground/[0.06] hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {label}
      </Link>
    );
  };

  return (
    <>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={cn("flex h-16 shrink-0 items-center px-5 transition-opacity hover:opacity-90", logoClassName)}
      >
        <Logo {...brand} className="h-7 w-auto max-w-full object-contain object-left" />
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pt-2">
        <div className="space-y-0.5">{main.map(link)}</div>
        {admin.length > 0 && (
          <>
            <p className="px-2.5 pb-1.5 pt-6 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
              Manage
            </p>
            <div className="space-y-0.5">{admin.map(link)}</div>
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-foreground/10 p-3">
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
export function AppShell({
  children,
  logoUrl = DEFAULT_BRAND.logoUrl,
  appName = DEFAULT_BRAND.name,
}: {
  children: React.ReactNode;
  /** From Admin > Branding via app/(app)/layout.tsx; the code default otherwise. */
  logoUrl?: string;
  appName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const brand = { logoUrl, appName };

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground md:flex-row">
      <header className="flex items-center justify-between bg-sidebar px-3 py-2 text-sidebar-foreground md:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-label="Open menu"
            className="rounded-md p-2 transition-colors hover:bg-sidebar-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <MenuIcon className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            {/* pr-12 keeps the logo clear of the sheet's close button. */}
            <SidebarBody {...brand} onNavigate={() => setMenuOpen(false)} logoClassName="pr-12" />
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="h-7">
          <Logo {...brand} className="h-7 w-auto max-w-48 object-contain" />
        </Link>
        {/* Spacer balances the menu button so the logo stays centred. */}
        <span className="w-9" aria-hidden="true" />
      </header>

      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBody {...brand} />
      </aside>

      <main className="min-w-0 flex-1 overflow-auto bg-canvas">{children}</main>
    </div>
  );
}
