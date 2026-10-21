// components/settings/ProfileForm.tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "./SettingsSection";

export function ProfileForm() {
  const me = useQuery(api.users.currentUser, {});
  const updateProfile = useMutation(api.users.updateProfile);
  const [submitting, setSubmitting] = useState(false);

  if (me === undefined) {
    return <SettingsSection title="Profile" description="Loading…" />;
  }

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
    <SettingsSection
      title="Profile"
      description="How you appear in the app."
      onSubmit={onSubmit}
      hint="Your email is how you sign in, so it can't be changed here."
      footer={<Button type="submit" disabled={submitting}>Save</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          {/* key: start fresh when the saved name changes (an input's default can't change later) */}
          <Input key={me?.name ?? ""} id="profile-name" name="name" defaultValue={me?.name ?? ""} placeholder="Your name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={me?.email ?? ""} disabled />
        </div>
      </div>
    </SettingsSection>
  );
}
