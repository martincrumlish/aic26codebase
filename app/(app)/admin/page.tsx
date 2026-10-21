// app/(app)/admin/page.tsx
"use client";
import { useQuery } from "convex/react";
import { ShieldXIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EmptyState, PageBody, PageHeader } from "@/components/app-shell/Page";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddUserDialog } from "@/components/admin/AddUserDialog";
import { GenerateSignupLinkDialog } from "@/components/admin/GenerateSignupLinkDialog";
import { UsersTable } from "@/components/admin/UsersTable";
import { SignupLinksCard } from "@/components/admin/SignupLinksCard";
import { WebhookCard } from "@/components/admin/WebhookCard";
import { StatsCards } from "@/components/admin/StatsCards";

const TITLE = "Admin";
const DESCRIPTION = "Manage users, signup links and integrations.";

export default function AdminPage() {
  const me = useQuery(api.users.currentUser, {});

  if (me === undefined) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <PageBody className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </PageBody>
      </>
    );
  }

  // Friendly UI guard. The real enforcement is server-side: every admin.*
  // function calls requireAdmin and throws for anyone else.
  if (me === null || me.role !== "admin") {
    return (
      <>
        <PageHeader title={TITLE} />
        <PageBody>
          <EmptyState icon={ShieldXIcon} title="Access denied" description="This page is for admins only." />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={
          <>
            <AddUserDialog />
            <GenerateSignupLinkDialog />
          </>
        }
      />
      <PageBody className="space-y-6">
        <StatsCards />

        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Users</CardTitle>
            <CardDescription>Everyone with an account. Change roles, reset passwords, revoke or delete.</CardDescription>
          </CardHeader>
          <div className="[&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
            <UsersTable currentUserId={me._id} />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signup links</CardTitle>
            <CardDescription>Share a link to let people create an account. Links work until you revoke them.</CardDescription>
          </CardHeader>
          <div className="px-5">
            <SignupLinksCard />
          </div>
        </Card>

        <WebhookCard />
      </PageBody>
    </>
  );
}
