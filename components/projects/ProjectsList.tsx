// components/projects/ProjectsList.tsx — the example feature's list page.
// Pattern: usePaginatedQuery for the list (live updates, "Load more"), a
// usage query for the plan limit, and a mutation for create.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { PaperclipIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function ProjectsList() {
  const { results, status, loadMore } = usePaginatedQuery(api.projects.list, {}, { initialNumItems: 20 });
  const usage = useQuery(api.projects.usage, {});
  const create = useMutation(api.projects.create);
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
      toast.success("Project created.");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Couldn't create the project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {usage && (
        <p className="text-sm text-muted-foreground">
          {usage.limit === null
            ? `${usage.count} projects on Pro.`
            : `${usage.count} of ${usage.limit} projects on the Free plan.`}
        </p>
      )}

      {atLimit ? (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          You&apos;ve used all {usage.limit} projects on the Free plan.{" "}
          <Link href="/pricing" className={buttonVariants({ size: "sm", variant: "default" })}>
            Upgrade to Pro
          </Link>
        </div>
      ) : (
        <form onSubmit={onCreate} className="max-w-lg space-y-3 rounded-xl border p-4">
          <div className="space-y-2">
            <Label htmlFor="np-name">Name</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-description">Description (optional)</Label>
            <Textarea
              id="np-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </div>
          <Button type="submit" disabled={saving}>Create project</Button>
        </form>
      )}

      {results.length === 0 && status !== "LoadingFirstPage" ? (
        <p className="text-sm text-muted-foreground">No projects yet. Create your first one above.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {results.map((p) => (
            <li key={p._id}>
              <Link
                href={`/projects/${p._id}`}
                className="flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  {p.description && (
                    <span className="block truncate text-sm text-muted-foreground">{p.description}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {p.hasAttachment && <PaperclipIcon className="size-3.5" aria-label="Has a file" />}
                  {formatDate(p.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(20)}>Load more</Button>
      )}
    </div>
  );
}
