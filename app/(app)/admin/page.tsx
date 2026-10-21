// app/(app)/admin/page.tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AddUserDialog } from "@/components/admin/AddUserDialog";
import { GenerateSignupLinkDialog } from "@/components/admin/GenerateSignupLinkDialog";
import { UsersTable } from "@/components/admin/UsersTable";
import { SignupLinksCard } from "@/components/admin/SignupLinksCard";
import { WebhookCard } from "@/components/admin/WebhookCard";
import { StatsCards } from "@/components/admin/StatsCards";

export default function AdminPage() {
  const me = useQuery(api.users.currentUser, {});

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // Friendly UI guard. The real enforcement is server-side: every admin.*
  // function calls requireAdmin and throws for anyone else.
  if (me === null || me.role !== "admin") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-destructive">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page is for admins only.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-7 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage users, signup links, and integrations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddUserDialog />
          <GenerateSignupLinkDialog />
        </div>
      </div>
      <StatsCards />
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Signup links</h2>
        <SignupLinksCard />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Users</h2>
        <UsersTable currentUserId={me._id} />
      </section>
      <WebhookCard />
    </div>
  );
}
