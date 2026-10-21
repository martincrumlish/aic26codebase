// components/projects/ProjectsList.tsx — the example feature's list page.
// Pattern: usePaginatedQuery for the list (live updates, "Load more"), a
// usage query for the plan limit, and a mutation for create.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { ChevronRightIcon, FolderIcon, PaperclipIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/app-shell/Page";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function ProjectsList() {
  const { results, status, loadMore } = usePaginatedQuery(api.projects.list, {}, { initialNumItems: 20 });
  const usage = useQuery(api.projects.usage, {});
  const create = useMutation(api.projects.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const atLimit = usage !== undefined && usage.limit !== null && usage.count >= usage.limit;

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await create({ name, description: description || undefined });
      setName("");
      setDescription("");
      setOpen(false);
      toast.success("Project created.");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Couldn't create the project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {usage &&
            (usage.limit === null
              ? `${usage.count} projects on Pro.`
              : `${usage.count} of ${usage.limit} projects on the Free plan.`)}
        </p>
        {atLimit ? (
          <Link href="/pricing" className={buttonVariants()}>
            <SparklesIcon />
            Upgrade to Pro
          </Link>
        ) : (
          <Button onClick={() => setOpen(true)}>
            <PlusIcon />
            New project
          </Button>
        )}
      </div>

      {atLimit && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm">
          You&apos;ve used all {usage.limit} projects on the Free plan. Pro has no limit.
        </div>
      )}

      {status === "LoadingFirstPage" ? (
        <Card className="gap-0 py-0" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-5 py-4 last:border-b-0">
              <div className="size-9 animate-pulse rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-64 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </Card>
      ) : results.length === 0 ? (
        <EmptyState
          icon={FolderIcon}
          title="No projects yet"
          description="Create your first project with New project. It will show up here."
        />
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {results.map((p) => (
              <li key={p._id}>
                <Link
                  href={`/projects/${p._id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    {p.description && (
                      <span className="block truncate text-sm text-muted-foreground">{p.description}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {p.hasAttachment && <PaperclipIcon className="size-3.5" aria-label="Has a file" />}
                    <span className="hidden sm:inline">Updated {formatDate(p.updatedAt)}</span>
                    <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => loadMore(20)}>Load more</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np-name">Name</Label>
              <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-description">Description (optional)</Label>
              <Textarea
                id="np-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Create project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
