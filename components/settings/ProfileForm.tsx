// components/settings/ProfileForm.tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ProfileForm() {
  const me = useQuery(api.users.currentUser, {});
  const updateProfile = useMutation(api.users.updateProfile);
  const [submitting, setSubmitting] = useState(false);

  if (me === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = (new FormData(e.currentTarget).get("name") as string)?.trim();
    setSubmitting(true);
    try {
      await updateProfile({ name: name || undefined });
      toast.success("Profile saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input id="profile-name" name="name" defaultValue={me?.name ?? ""} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={me?.email ?? ""} disabled />
      </div>
      <Button type="submit" disabled={submitting}>Save</Button>
    </form>
  );
}
