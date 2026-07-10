// components/auth/ActivateForm.tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ActivateForm({ token }: { token: string }) {
  const { signIn } = useAuthActions();
  const result = useQuery(api.provisioning.validateToken, { token });
  const consume = useMutation(api.provisioning.consumeActivationToken);
  const [submitting, setSubmitting] = useState(false);

  if (result === undefined) {
    return <p className="text-sm text-muted-foreground">Checking your activation link…</p>;
  }
  if (!result.valid) {
    return <p className="text-sm text-destructive">{result.reason ?? "This activation link is not valid."}</p>;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).toLowerCase().trim();
    setSubmitting(true);
    try {
      // 1. Consume the activation token (ensures pre-seeded users row, marks used).
      await consume({ token, email });
      // 2. Set the password via the gated Password signUp (row now exists → accepted).
      fd.set("flow", "signUp");
      await signIn("password", fd);
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Activation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Set a password to activate your account.</p>
      <div className="space-y-2">
        <Label htmlFor="act-email">Email</Label>
        <Input id="act-email" name="email" type="email" autoComplete="email" defaultValue={result.email ?? ""} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="act-password">Password</Label>
        <Input id="act-password" name="password" type="password" autoComplete="new-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>Activate account</Button>
    </form>
  );
}
