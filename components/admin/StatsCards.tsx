// components/admin/StatsCards.tsx
"use client";
import { useQuery } from "convex/react";
import { LinkIcon, ShieldIcon, UsersIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";

export function StatsCards() {
  const stats = useQuery(api.admin.platformStats, {});
  const items = [
    // stats.users counts the "user" role only; the card shows every account.
    { label: "Accounts", value: stats && stats.users + stats.admins, Icon: UsersIcon },
    { label: "Admins", value: stats?.admins, Icon: ShieldIcon },
    { label: "Active signup links", value: stats?.activeLinks, Icon: LinkIcon },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map(({ label, value, Icon }) => (
        <Card key={label} className="flex-row items-center gap-4 px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {value === undefined ? (
              <span className="mt-1 block h-7 w-10 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
