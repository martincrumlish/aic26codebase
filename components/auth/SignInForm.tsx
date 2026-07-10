// components/auth/SignInForm.tsx
"use client";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("flow", "signIn");
    setSubmitting(true);
    try {
      await signIn("password", formData);
      router.push("/dashboard");
    } catch (err) {
      const msg =
        err instanceof ConvexError ? (err.data as string) : "Sign-in failed.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onPassword} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pw-email">Email</Label>
        <Input id="pw-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-password">Password</Label>
        <Input
          id="pw-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        Sign in
      </Button>
      <a
        href="/reset"
        className="block text-center text-sm text-muted-foreground hover:underline"
      >
        Forgot your password?
      </a>
    </form>
  );
}
