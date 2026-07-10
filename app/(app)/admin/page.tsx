// app/admin/page.tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AddUserDialog } from "@/components/admin/AddUserDialog";
import { GenerateCreatorLinkDialog } from "@/components/admin/GenerateCreatorLinkDialog";
import { CreatorsTable } from "@/components/admin/CreatorsTable";
import { SignupLinksCard } from "@/components/admin/SignupLinksCard";
import { WebhookCard } from "@/components/admin/WebhookCard";
import { StatsCards } from "@/components/admin/StatsCards";

export default function AdminPage() {
  const me = useQuery(api.users.currentUser, {});

  // Loading state
  if (me === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-7">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // Role guard: operator-only UI. The backend operator.* functions also throw
  // for non-operators — this is the friendlier UI layer on top.
  if (me === null || me.role !== "operator") {
    return (
      <div className="mx-auto max-w-5xl px-8 py-7">
        <h1 className="text-2xl font-semibold tracking-tight text-destructive">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is for operators only.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-8 py-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operator console</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Provision creators and monitor the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddUserDialog />
          <GenerateCreatorLinkDialog />
        </div>
      </div>
      <StatsCards />
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Signup links</h2>
        <SignupLinksCard />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Creators</h2>
        <CreatorsTable />
      </section>
      <WebhookCard />
    </div>
  );
}
