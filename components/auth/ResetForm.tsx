// components/auth/ResetForm.tsx
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

export function ResetForm() {
  const { signIn } = useAuthActions();
  const available = useQuery(api.passwordReset.available, {});
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("flow", "reset");
    setEmail(fd.get("email") as string);
    setSubmitting(true);
    try {
      await signIn("password", fd);
    } catch (err) {
      // A deliberate, user-facing message (e.g. email isn't set up) is shown.
      // Anything else, including "no such account", is treated as success so
      // the form never reveals which emails exist.
      const message = authErrorMessage(err);
      if (message) {
        toast.error(message);
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    setStep("verify");
    toast.success("If that address has an account, a reset code is on its way.");
  }

  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("flow", "reset-verification");
    fd.set("email", email);
    setSubmitting(true);
    try {
      await signIn("password", fd);
      toast.success("Password updated. You are signed in.");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(authErrorMessage(err) ?? "Invalid or expired code.");
    } finally {
      setSubmitting(false);
    }
  }

  if (available === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!available) {
    return (
      <p className="text-sm text-muted-foreground">
        Password reset needs email, and email isn&apos;t set up for this app yet. Ask your
        administrator to set a new password for you.
      </p>
    );
  }

  // Distinct keys make React remount the inputs when the step changes;
  // otherwise the uncontrolled email input's value leaks into the code input.
  if (step === "request") {
    return (
      <form key="request" onSubmit={onRequest} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rs-email">Email</Label>
          <Input id="rs-email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>Send reset code</Button>
      </form>
    );
  }

  return (
    <form key="verify" onSubmit={onVerify} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the 8-digit code we emailed to {email} and choose a new password.
      </p>
      <div className="space-y-2">
        <Label htmlFor="rs-code">Reset code</Label>
        <Input id="rs-code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rs-newpw">New password</Label>
        <Input
          id="rs-newpw"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>Set new password</Button>
    </form>
  );
}
