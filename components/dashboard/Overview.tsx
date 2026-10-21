// components/dashboard/Overview.tsx — the signed-in home page: plan, usage,
// AI status, and recent activity. A starting point: replace or extend it with
// whatever your product's users need to see first.
"use client";
import { useId } from "react";
import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ChevronRightIcon, FolderIcon, MessageSquareIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageBody, PageHeader } from "@/components/app-shell/Page";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const linkClass = "text-sm font-medium text-primary hover:underline";

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <Card className="h-full gap-3">
        <CardHeader>
          <h2 id={id} className="text-sm font-medium text-muted-foreground">{label}</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded bg-muted", className)} />;
}

export function Overview() {
  const me = useQuery(api.users.currentUser, {});
  const billing = useQuery(api.billing.status, {});
  const usage = useQuery(api.projects.usage, {});
  const ai = useQuery(api.ai.getAiStatus, {});
  const aiUsage = useQuery(api.ai.usage, {});
  const projects = usePaginatedQuery(api.projects.list, {}, { initialNumItems: 5 });
  const chats = usePaginatedQuery(api.chat.listConversations, {}, { initialNumItems: 5 });

  const firstName = me?.name?.trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Your plan, usage and recent work at a glance."
      />
      <PageBody className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Plan"
            value={
              billing ? (
                <span className="flex items-center gap-2">
                  {billing.plan === "pro" ? "Pro" : "Free"}
                  {billing.plan === "pro" && <Badge>Active</Badge>}
                </span>
              ) : (
                <Skeleton className="h-8 w-20" />
              )
            }
          >
            {billing?.plan === "free" && billing.billingEnabled ? (
              <Link href="/pricing" className={linkClass}>Upgrade to Pro</Link>
            ) : billing ? (
              <Link href="/settings/billing" className={linkClass}>Billing settings</Link>
            ) : null}
          </Stat>

          <Stat
            label="Projects"
            value={
              usage ? (usage.limit === null ? `${usage.count}` : `${usage.count} of ${usage.limit}`) : <Skeleton className="h-8 w-20" />
            }
          >
            {usage && usage.limit !== null ? (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Projects used"
                aria-valuenow={usage.count}
                aria-valuemax={usage.limit}
              >
                <div
                  className={cn("h-full rounded-full", usage.count >= usage.limit ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${Math.min(100, (usage.count / usage.limit) * 100)}%` }}
                />
              </div>
            ) : usage ? (
              <p className="text-sm text-muted-foreground">Unlimited on Pro.</p>
            ) : null}
          </Stat>

          <Stat
            label="AI chat"
            value={ai ? (ai.enabled ? "Ready" : "Not set up") : <Skeleton className="h-8 w-24" />}
          >
            {ai?.enabled ? (
              <p className="text-sm text-muted-foreground">
                {ai.source === "own"
                  ? "Using your OpenRouter key."
                  : aiUsage?.limit != null
                    ? `${aiUsage.used.toLocaleString("en-US")} of ${aiUsage.limit.toLocaleString("en-US")} messages this month.`
                    : "Using the app's built-in key."}
              </p>
            ) : ai ? (
              <Link href="/settings/ai" className={linkClass}>Add your key</Link>
            ) : null}
          </Stat>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Recent
            title="Recent projects"
            viewAll="/projects"
            loading={projects.status === "LoadingFirstPage"}
            empty={{ text: "No projects yet.", link: "/projects", label: "Create a project" }}
            items={projects.results.map((p) => ({
              id: p._id,
              href: `/projects/${p._id}`,
              title: p.name,
              meta: formatDate(p.updatedAt),
            }))}
            Icon={FolderIcon}
          />
          <Recent
            title="Recent conversations"
            viewAll="/chat"
            loading={chats.status === "LoadingFirstPage"}
            empty={{ text: "No conversations yet.", link: "/chat", label: "Start a chat" }}
            items={chats.results.map((c) => ({
              id: c._id,
              href: `/chat/${c._id}`,
              title: c.title,
              meta: formatDate(c.updatedAt),
            }))}
            Icon={MessageSquareIcon}
          />
        </div>
      </PageBody>
    </>
  );
}

function Recent({
  title,
  viewAll,
  loading,
  empty,
  items,
  Icon,
}: {
  title: string;
  viewAll: string;
  loading: boolean;
  empty: { text: string; link: string; label: string };
  items: { id: string; href: string; title: string; meta: string }[];
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="gap-0 pb-2">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        {items.length > 0 && (
          <CardAction>
            <Link href={viewAll} className={linkClass}>View all</Link>
          </CardAction>
        )}
      </CardHeader>
      {loading ? (
        <div className="space-y-3 px-5 py-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 pb-4 pt-1 text-sm text-muted-foreground">
          {empty.text}{" "}
          <Link href={empty.link} className={linkClass}>{empty.label}</Link>
        </div>
      ) : (
        <ul className="px-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
