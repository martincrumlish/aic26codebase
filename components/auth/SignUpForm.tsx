// components/auth/SignUpForm.tsx — open sign-up (SIGNUP_MODE "open", the default).
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmailCodeStep } from "./EmailCodeStep";
import { GoogleButton } from "./GoogleButton";

export function SignUpForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const mode = useQuery(api.signup.mode, {});
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  if (mode === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (mode === "link") {
    return (
      <p className="text-sm text-muted-foreground">
        Sign-up is by invitation. Ask the site&apos;s administrator for a signup link, or{" "}
        <Link href="/signin" className="underline">sign in</Link> if you already have an account.
      </p>
    );
  }
  if (confirmEmail) {
    return <EmailCodeStep email={confirmEmail} onDone={() => router.push("/dashboard")} />;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("flow", "signUp");
    setSubmitting(true);
    try {
      const result = await signIn("password", fd);
      if (result?.signingIn === false) {
        setConfirmEmail((fd.get("email") as string).trim().toLowerCase());
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form key="sign-up" onSubmit={onSubmit} className="space-y-4">
      <GoogleButton />
      <div className="space-y-2">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-password">Password</Label>
        <Input
          id="su-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/signin" className="underline">Sign in</Link>
      </p>
    </form>
  );
}
