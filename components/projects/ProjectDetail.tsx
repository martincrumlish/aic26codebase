// components/projects/ProjectDetail.tsx — the example feature's detail page:
// edit, attach a file (Convex storage), delete.
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FileTextIcon, FolderXIcon, Trash2Icon } from "lucide-react";
import { EmptyState, PageBody, PageHeader } from "@/components/app-shell/Page";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BACK = { href: "/projects", label: "Projects" };

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const errorText = (err: unknown, fallback: string) =>
  err instanceof ConvexError ? (err.data as string) : fallback;

export function ProjectDetail({ projectId: id }: { projectId: string }) {
  const projectId = id as Id<"projects">;
  // undefined while loading; null if it doesn't exist or isn't yours.
  const project = useQuery(api.projects.get, { projectId });
  const update = useMutation(api.projects.update);
  const remove = useMutation(api.projects.remove);
  const generateUploadUrl = useMutation(api.projects.generateUploadUrl);
  const setAttachment = useMutation(api.projects.setAttachment);
  const removeAttachment = useMutation(api.projects.removeAttachment);
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Set once we delete, so the query going null doesn't flash "not found"
  // while we navigate back to the list.
  const [deleted, setDeleted] = useState(false);

  // Fill the form when the project loads (or changes elsewhere).
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
  }, [project]);

  if (project === undefined || deleted) {
    return (
      <>
        <PageHeader title={<span className="block h-8 w-56 animate-pulse rounded bg-muted" />} back={BACK} />
        <PageBody>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </PageBody>
      </>
    );
  }
  if (project === null) {
    return (
      <>
        <PageHeader title="Project not found" back={BACK} />
        <PageBody>
          <EmptyState
            icon={FolderXIcon}
            title="Nothing here"
            description="It may have been deleted, or the link is wrong."
            action={<Link href="/projects" className={buttonVariants({ variant: "outline" })}>Back to projects</Link>}
          />
        </PageBody>
      </>
    );
  }

  async function run(work: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      toast.error(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      await update({ projectId, name, description: description || undefined });
      toast.success("Saved.");
    }, "Couldn't save.");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await run(async () => {
      // Convex file upload: 1) get a short-lived URL, 2) POST the file to it,
      // 3) record the returned storage id on the project.
      const url = await generateUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const result = await setAttachment({ projectId, storageId, fileName: file.name });
      if (result.ok) toast.success("File attached.");
      else toast.error(result.error);
    }, "Couldn't upload the file.");
  }

  async function onDelete() {
    await run(async () => {
      setDeleted(true);
      try {
        await remove({ projectId });
      } catch (err) {
        setDeleted(false);
        throw err;
      }
      toast.success("Project deleted.");
      router.push("/projects");
    }, "Couldn't delete the project.");
  }

  return (
    <>
      <PageHeader
        title={project.name}
        description={`Updated ${formatDate(project.updatedAt)}`}
        back={BACK}
        actions={
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon />
            Delete project
          </Button>
        }
      />
      <PageBody className="grid items-start gap-6 lg:grid-cols-3">
        <form onSubmit={onSave} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>The project&apos;s name and description.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pd-name">Name</Label>
                <Input id="pd-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pd-description">Description</Label>
                <Textarea
                  id="pd-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={2000}
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={busy}>Save changes</Button>
            </CardFooter>
          </Card>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>File</CardTitle>
            <CardDescription>One file per project, up to 10 MB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.attachment ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-xs">
                  <FileTextIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {project.attachment.url ? (
                    <a href={project.attachment.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {project.attachment.name}
                    </a>
                  ) : (
                    project.attachment.name
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(() => removeAttachment({ projectId }), "Couldn't remove the file.")}
                >
                  Remove file
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No file attached yet.</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="pd-file">{project.attachment ? "Replace file" : "Attach a file"}</Label>
              <Input id="pd-file" type="file" disabled={busy} onChange={(e) => void onFile(e)} className="h-auto py-1.5 text-muted-foreground file:mr-3 file:h-7 file:rounded-md file:bg-muted file:px-3 file:text-foreground" />
            </div>
          </CardContent>
        </Card>
      </PageBody>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes <strong className="text-foreground">{project.name}</strong> and its file.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void onDelete()}>
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
