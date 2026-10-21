// components/auth/SignInForm.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmailCodeStep } from "./EmailCodeStep";
import { GoogleButton } from "./GoogleButton";

/** `googleReturn`: we're back from Google without a session (see GoogleButton). */
export function SignInForm({ googleReturn = false }: { googleReturn?: boolean }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const mode = useQuery(api.signup.mode, {});
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  if (confirmEmail) {
    return <EmailCodeStep email={confirmEmail} onDone={() => router.push("/dashboard")} />;
  }

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("flow", "signIn");
    setSubmitting(true);
    try {
      const result = await signIn("password", formData);
      if (result?.signingIn === false) {
        // Email is set up and this account hasn't confirmed its address yet.
        setConfirmEmail((formData.get("email") as string).trim().toLowerCase());
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      const msg =
        err instanceof ConvexError ? (err.data as string) : "Sign-in failed.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form key="sign-in" onSubmit={onPassword} className="space-y-4">
      {googleReturn && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          Google sign-in didn&apos;t go through. If this email already has an account, sign in with your
          password below.
        </p>
      )}
      <GoogleButton />
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
      {mode === "open" && (
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline">Sign up</Link>
        </p>
      )}
    </form>
  );
}
