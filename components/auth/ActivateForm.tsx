// components/auth/ActivateForm.tsx
"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { authErrorMessage } from "@/lib/authError";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmailCodeStep } from "./EmailCodeStep";

export function ActivateForm({ token }: { token: string }) {
  const { signIn } = useAuthActions();
  const result = useQuery(api.provisioning.validateToken, { token });
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  // Checked first: the activation link is already used up by the time the
  // account is waiting for its email code.
  if (confirmEmail) {
    return <EmailCodeStep email={confirmEmail} onDone={() => (window.location.href = "/dashboard")} />;
  }
  if (result === undefined) {
    return <p className="text-sm text-muted-foreground">Checking your activation link…</p>;
  }
  if (!result.valid) {
    return <p className="text-sm text-destructive">{result.reason ?? "This activation link is not valid."}</p>;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // The activation token is the proof that this account is yours: the server
    // checks it and uses it up while creating your password (convex/authGate.ts).
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
      toast.error(authErrorMessage(err) ?? "Activation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Set a password to activate your account.</p>
      <div className="space-y-2">
        <Label htmlFor="act-email">Email</Label>
        <Input
          id="act-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={result.email ?? ""}
          readOnly
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="act-password">Password</Label>
        <Input id="act-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>Activate account</Button>
    </form>
  );
}
