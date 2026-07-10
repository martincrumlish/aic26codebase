"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { SettingsIcon, LogOutIcon, ChevronUpIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Derive up to two initials from an email address. */
function initials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "??";
}

interface AccountMenuProps {
  email: string;
  name?: string | null;
}

/**
 * Account menu rendered at the bottom-left of the sidebar.
 * Opens on hover (via Base-UI's built-in openOnHover on the trigger) and
 * also responds to click/keyboard for full accessibility.
 * The popup opens upward (side="top") so it doesn't go off-screen.
 */
export function AccountMenu({ email, name }: AccountMenuProps) {
  const { signOut } = useAuthActions();
  const router = useRouter();

  const displayName = name || email;
  const avatarLetters = initials(email);

  async function handleSignOut() {
    await signOut();
    router.push("/signin");
  }

  return (
    <DropdownMenu>
      {/* Trigger row */}
      <DropdownMenuTrigger
        openOnHover
        delay={150}
        closeDelay={200}
        className={cn(
          // Reset base button styling so we can style freely
          "w-full cursor-pointer appearance-none bg-transparent text-left",
          "flex items-center gap-2.5 rounded-lg px-2 py-2",
          "text-sidebar-foreground/80 transition-colors",
          "hover:bg-white/10 hover:text-sidebar-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          // When the menu is open, keep the row highlighted
          "data-popup-open:bg-white/10 data-popup-open:text-sidebar-foreground",
        )}
        aria-label="Account menu"
      >
        {/* Avatar circle */}
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground"
          aria-hidden="true"
        >
          {avatarLetters}
        </span>

        {/* Identity text */}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {displayName}
        </span>

        {/* Chevron */}
        <ChevronUpIcon className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>

      {/* Menu popup — opens above the trigger */}
      <DropdownMenuContent
        side="top"
        sideOffset={6}
        align="start"
        className="w-52"
      >
        <DropdownMenuItem render={<Link href="/settings" />}>
          <SettingsIcon className="size-4" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => void handleSignOut()}
          className="flex items-center gap-2"
        >
          <LogOutIcon className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
