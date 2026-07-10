// components/auth/ResetForm.tsx
"use client";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ResetForm() {
  const { signIn } = useAuthActions();
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
      setStep("verify");
      toast.success("If that address is enabled, a reset code is on its way.");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Could not send a reset code.");
    } finally {
      setSubmitting(false);
    }
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
      toast.error(err instanceof ConvexError ? (err.data as string) : "Invalid or expired code.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "request") {
    return (
      <form onSubmit={onRequest} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rs-email">Email</Label>
          <Input id="rs-email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>Send reset code</Button>
      </form>
    );
  }

  return (
    <form onSubmit={onVerify} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rs-code">Reset code</Label>
        <Input id="rs-code" name="code" inputMode="numeric" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rs-newpw">New password</Label>
        <Input id="rs-newpw" name="newPassword" type="password" autoComplete="new-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>Set new password</Button>
    </form>
  );
}
