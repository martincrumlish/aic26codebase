// components/admin/StatsCards.tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatsCards() {
  const stats = useQuery(api.admin.platformStats, {});
  if (stats === undefined) return null;
  const items = [
    { label: "Users", value: stats.users },
    { label: "Admins", value: stats.admins },
    { label: "Active signup links", value: stats.activeLinks },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{it.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{it.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
