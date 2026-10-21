// components/admin/UsersTable.tsx
"use client";
import { useState } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BanIcon,
  EllipsisIcon,
  KeyRoundIcon,
  RotateCcwIcon,
  ShieldIcon,
  ShieldOffIcon,
  Trash2Icon,
} from "lucide-react";

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
  const setPassword = useAction(api.admin.setUserPassword);

  // Delete is destructive (removes the account + ALL their content), so it's
  // gated behind a dialog that requires typing the email to confirm.
  const [target, setTarget] = useState<{ id: Id<"users">; email: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [pwTarget, setPwTarget] = useState<{ id: Id<"users">; email: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

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

  async function onSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pwTarget) return;
    const password = new FormData(e.currentTarget).get("password") as string;
    setSavingPw(true);
    await attempt(
      () => setPassword({ userId: pwTarget.id, password }),
      `Password updated. ${pwTarget.email} has been signed out everywhere.`,
    );
    setSavingPw(false);
    setPwTarget(null);
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u._id === currentUserId;
              const isAdmin = u.role === "admin";
              const revoked = u.status === "revoked";
              const email = u.email ?? "";
              return (
                <TableRow key={u._id}>
                  <TableCell>
                    <div className="flex items-center gap-3 py-0.5">
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground"
                        aria-hidden="true"
                      >
                        {(u.name || email).slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        {u.name && <p className="truncate font-medium">{u.name}</p>}
                        <p className={u.name ? "truncate text-xs text-muted-foreground" : "truncate font-medium"}>{email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isAdmin ? "default" : "outline"} className="capitalize">{u.role ?? "user"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={revoked ? "destructive" : "secondary"} className="capitalize">
                      {u.status ?? "active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${email}`}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted"
                        >
                          <EllipsisIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {isAdmin ? (
                            <DropdownMenuItem
                              onClick={() =>
                                void attempt(() => setRole({ userId: u._id, role: "user" }), "Admin rights removed.")
                              }
                            >
                              <ShieldOffIcon />
                              Remove admin
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  void attempt(() => setRole({ userId: u._id, role: "admin" }), "User is now an admin.")
                                }
                              >
                                <ShieldIcon />
                                Make admin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPwTarget({ id: u._id, email })}>
                                <KeyRoundIcon />
                                Set password
                              </DropdownMenuItem>
                              {revoked ? (
                                <DropdownMenuItem
                                  onClick={() => void attempt(() => restore({ userId: u._id }), "Account restored.")}
                                >
                                  <RotateCcwIcon />
                                  Restore
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => void attempt(() => revoke({ userId: u._id }), "Account revoked.")}
                                >
                                  <BanIcon />
                                  Revoke
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setTarget({ id: u._id, email })}>
                                <Trash2Icon />
                                Delete account
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={pwTarget !== null} onOpenChange={(o) => { if (!o) setPwTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSetPassword} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              For <strong className="text-foreground">{pwTarget?.email}</strong>. They&apos;ll be
              signed out everywhere and can sign in with the new password straight away.
            </p>
            <div className="space-y-2">
              <Label htmlFor="pw-new">New password</Label>
              <Input
                id="pw-new"
                name="password"
                type="text"
                autoComplete="off"
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                At least 8 characters. Share it with them securely.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingPw}>
                {savingPw ? "Saving…" : "Save password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
