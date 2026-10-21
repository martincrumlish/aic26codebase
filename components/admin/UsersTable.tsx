// components/admin/UsersTable.tsx
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

async function attempt(fn: () => Promise<unknown>, success: string) {
  try {
    await fn();
    toast.success(success);
  } catch (err) {
    toast.error(err instanceof ConvexError ? (err.data as string) : "Something went wrong.");
  }
}

export function UsersTable({ currentUserId }: { currentUserId: string }) {
  const users = useQuery(api.admin.listUsers, {});
  const setRole = useMutation(api.admin.setUserRole);
  const revoke = useMutation(api.admin.revokeUser);
  const restore = useMutation(api.admin.restoreUser);
  const deleteUser = useMutation(api.admin.deleteUserAccount);

  // Delete is destructive (removes the account + ALL their content), so it's
  // gated behind a dialog that requires typing the email to confirm.
  const [target, setTarget] = useState<{ id: Id<"users">; email: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (users === undefined) return <p className="text-sm text-muted-foreground">Loading users…</p>;

  const confirmReady =
    target !== null && confirmText.trim().toLowerCase() === target.email.toLowerCase();

  function closeDelete() {
    setTarget(null);
    setConfirmText("");
  }

  async function onDelete() {
    if (!target || !confirmReady) return;
    setDeleting(true);
    await attempt(() => deleteUser({ userId: target.id }), "Account deleted.");
    setDeleting(false);
    closeDelete();
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u._id === currentUserId;
              const isAdmin = u.role === "admin";
              const revoked = u.status === "revoked";
              return (
                <TableRow key={u._id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={isAdmin ? "default" : "outline"}>{u.role ?? "user"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={revoked ? "destructive" : "secondary"}>
                      {u.status ?? "active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap text-right">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : isAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void attempt(
                            () => setRole({ userId: u._id, role: "user" }),
                            "Admin rights removed.",
                          )
                        }
                      >
                        Remove admin
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void attempt(
                              () => setRole({ userId: u._id, role: "admin" }),
                              "User is now an admin.",
                            )
                          }
                        >
                          Make admin
                        </Button>
                        {revoked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Re-enable sign-in"
                            onClick={() =>
                              void attempt(() => restore({ userId: u._id }), "Account restored.")
                            }
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Disable sign-in but keep the account and content"
                            onClick={() =>
                              void attempt(() => revoke({ userId: u._id }), "Account revoked.")
                            }
                          >
                            Revoke
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          title="Permanently delete the account and all their content"
                          onClick={() => setTarget({ id: u._id, email: u.email ?? "" })}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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
