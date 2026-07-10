// components/settings/SecurityForm.tsx
"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SecurityForm() {
  const changePassword = useAction(api.password.changePassword);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const currentPassword = fd.get("password") as string;
    const newPassword = fd.get("newPassword") as string;

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Password updated.");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as string)
          : "Could not update password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sec-current">Current password</Label>
        <Input
          id="sec-current"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sec-new">New password</Label>
        <Input
          id="sec-new"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" disabled={submitting}>
        Update password
      </Button>
    </form>
  );
}
