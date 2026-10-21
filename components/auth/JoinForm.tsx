// components/auth/JoinForm.tsx
"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmailCodeStep } from "./EmailCodeStep";

export function JoinForm({ token }: { token: string }) {
  const { signIn } = useAuthActions();
  const result = useQuery(api.provisioning.validateToken, { token });
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  // Checked first: a single-use link is already used up by the time the
  // account is waiting for its email code.
  if (confirmEmail) {
    return <EmailCodeStep email={confirmEmail} onDone={() => (window.location.href = "/dashboard")} />;
  }
  if (result === undefined) {
    return <p className="text-sm text-muted-foreground">Checking your link…</p>;
  }
  if (!result.valid) {
    return (
      <p className="text-sm text-destructive">
        {result.reason ?? "This signup link is not valid."}
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("flow", "signUp");
    fd.set("token", token);
    setSubmitting(true);
    try {
      const res = await signIn("password", fd);
      if (res?.signingIn === false) {
        setConfirmEmail((fd.get("email") as string).trim().toLowerCase());
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as string) : "Could not create your account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose an email and password to get started.
      </p>
      <div className="space-y-2">
        <Label htmlFor="join-email">Email</Label>
        <Input
          id="join-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={result.email ?? ""}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="join-password">Password</Label>
        <Input id="join-password" name="password" type="password" autoComplete="new-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>Create account</Button>
    </form>
  );
}
