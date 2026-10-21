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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  if (project === undefined || deleted) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (project === null) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-xl font-semibold">Project not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been deleted, or the link is wrong.</p>
        <Link href="/projects" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
          Back to projects
        </Link>
      </div>
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
    <div className="space-y-10">
      <form onSubmit={onSave} className="max-w-lg space-y-4">
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
            rows={4}
            maxLength={2000}
          />
        </div>
        <Button type="submit" disabled={busy}>Save changes</Button>
      </form>

      <section className="max-w-lg space-y-3">
        <h2 className="text-lg font-medium">File</h2>
        {project.attachment ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {project.attachment.url ? (
              <a href={project.attachment.url} target="_blank" rel="noreferrer" className="underline">
                {project.attachment.name}
              </a>
            ) : (
              <span>{project.attachment.name}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => removeAttachment({ projectId }), "Couldn't remove the file.")}
            >
              Remove file
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No file attached. Files can be up to 10 MB.</p>
        )}
        <div className="space-y-2">
          <Label htmlFor="pd-file">{project.attachment ? "Replace file" : "Attach a file"}</Label>
          <Input id="pd-file" type="file" disabled={busy} onChange={(e) => void onFile(e)} />
        </div>
      </section>

      <section className="max-w-lg space-y-3">
        <h2 className="text-lg font-medium">Danger zone</h2>
        <Button variant="destructive" onClick={() => setConfirmDelete(true)}>Delete project</Button>
      </section>

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
    </div>
  );
}
