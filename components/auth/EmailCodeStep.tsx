// components/auth/EmailCodeStep.tsx — "check your email" step shown when an
// account must confirm its email address before it gets a session (only when
// email is set up; see convex/auth.ts).
"use client";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function EmailCodeStep({ email, onDone }: { email: string; onDone: () => void }) {
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("flow", "email-verification");
    fd.set("email", email);
    setSubmitting(true);
    try {
      await signIn("password", fd);
      onDone();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "That code didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form key="email-code" onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We&apos;ve emailed an 8-digit code to <strong className="text-foreground">{email}</strong>.
        Enter it to confirm your email address.
      </p>
      <div className="space-y-2">
        <Label htmlFor="ec-code">Confirmation code</Label>
        <Input id="ec-code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        Confirm
      </Button>
      <p className="text-xs text-muted-foreground">
        Didn&apos;t get it? Check your spam folder, or sign in again for a new code.
      </p>
    </form>
  );
}
