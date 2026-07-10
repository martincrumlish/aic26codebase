// components/admin/AddUserDialog.tsx
"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserPlusIcon } from "lucide-react";

/**
 * Operator action: create a creator account directly with an initial password
 * the operator sets (and shares). Unlike the invite link, the account exists and
 * can sign in immediately. The new user can change the password via "Forgot your
 * password?".
 */
export function AddUserDialog() {
  // createUserAccount is an ACTION (it uses Convex Auth's createAccount helper).
  const createUser = useAction(api.operator.createUserAccount);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string)?.trim();
    const name = (fd.get("name") as string)?.trim() || undefined;
    const password = fd.get("password") as string;
    setSubmitting(true);
    try {
      await createUser({ email, name, password });
      toast.success(`Account created for ${email}.`);
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as string) : "Could not create the account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserPlusIcon className="mr-1.5 size-4" />
        Add user account
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a user account</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="au-email">Email</Label>
            <Input id="au-email" name="email" type="email" autoComplete="off" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="au-name">Name (optional)</Label>
            <Input id="au-name" name="name" autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="au-password">Initial password</Label>
            {/* type=text so the operator can read/copy the password they're setting to share. */}
            <Input
              id="au-password"
              name="password"
              type="text"
              autoComplete="off"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters. Share it with the new user — they can change it later via
              &ldquo;Forgot your password?&rdquo;.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
