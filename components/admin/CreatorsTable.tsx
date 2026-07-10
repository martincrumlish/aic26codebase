// components/admin/CreatorsTable.tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreatorsTable() {
  const creators = useQuery(api.operator.listCreators, {});
  const revokeCreator = useMutation(api.operator.revokeCreator);
  const deleteUser = useMutation(api.operator.deleteUserAccount);

  // Delete is destructive (removes the account + ALL their content), so it's
  // gated behind a dialog that requires typing the email to confirm.
  const [target, setTarget] = useState<{ id: Id<"users">; email: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (creators === undefined) return <p className="text-sm text-muted-foreground">Loading creators…</p>;
  if (creators.length === 0) return <p className="text-sm text-muted-foreground">No creators yet.</p>;

  const confirmReady =
    target !== null && confirmText.trim().toLowerCase() === target.email.toLowerCase();

  function closeDelete() {
    setTarget(null);
    setConfirmText("");
  }

  async function onDelete() {
    if (!target || !confirmReady) return;
    setDeleting(true);
    try {
      await deleteUser({ userId: target.id });
      toast.success("Account deleted.");
      closeDelete();
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as string) : "Could not delete the account.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creators.map((c) => (
            <TableRow key={c._id}>
              <TableCell>{c.email}</TableCell>
              <TableCell>{c.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={c.status === "revoked" ? "destructive" : "secondary"}>
                  {c.status ?? "active"}
                </Badge>
              </TableCell>
              <TableCell className="space-x-2 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={c.status === "revoked"}
                  title="Disable sign-in but keep the account and content"
                  onClick={async () => {
                    await revokeCreator({ creatorId: c._id });
                    toast.success("Creator revoked.");
                  }}
                >
                  Revoke
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  title="Permanently delete the account and all their content"
                  onClick={() => setTarget({ id: c._id, email: c.email ?? "" })}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={target !== null} onOpenChange={(o) => { if (!o) closeDelete(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this account?</DialogTitle>
          </DialogHeader>
          <p className="py-1 text-sm text-muted-foreground">
            This permanently deletes <strong className="text-foreground">{target?.email}</strong>{" "}
            and <strong className="text-foreground">all</strong> of their account data.
            This cannot be undone.
          </p>
          <div className="space-y-2">
            <Label htmlFor="del-confirm">Type the email to confirm</Label>
            <Input
              id="del-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={target?.email}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDelete}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmReady || deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
