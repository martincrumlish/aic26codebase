// components/settings/GoogleConnect.tsx — Settings > Sign-in & security: connect Google
// as a way to sign in, or disconnect it. Hidden until Google is set up
// (`npm run setup:google`). Connecting is a Google sign-in while signed in;
// the server attaches it to this account (convex/lib/googleConnect.ts).
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/auth/GoogleButton";
import { SettingsSection } from "./SettingsSection";

export function GoogleConnect() {
  const status = useQuery(api.google.status, {});
  const disconnect = useMutation(api.google.disconnect);
  const { signIn } = useAuthActions();
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const reported = useRef(false);

  // Back from Google (?connect=google): say whether it worked, once.
  const returning = params.get("connect") === "google";
  useEffect(() => {
    if (!returning || status === undefined || reported.current) return;
    reported.current = true;
    if (status.connected) toast.success("Google connected. You can now sign in with Google.");
    else toast.error("Couldn't connect Google. That Google account may already be connected to a different account.");
    router.replace("/settings/security");
  }, [returning, status, router]);

  if (status === undefined || (!status.enabled && !status.connected)) return null;

  async function onDisconnect() {
    setBusy(true);
    try {
      await disconnect({});
      toast.success("Google disconnected.");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as string) : "Couldn't disconnect Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      title="Google"
      description="Sign in with your Google account instead of a password."
      footer={
        status.connected ? (
          <Button variant="outline" disabled={busy} onClick={() => void onDisconnect()}>
            Disconnect
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy || !status.enabled}
            onClick={() => {
              setBusy(true);
              void signIn("google", { redirectTo: "/settings/security?connect=google" }).catch(() => setBusy(false));
            }}
          >
            Connect Google
          </Button>
        )
      }
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card shadow-xs">
          <GoogleLogo />
        </span>
        <p className="text-sm text-muted-foreground">
          {status.connected ? (
            <>Connected as <span className="font-medium text-foreground">{status.email}</span>. You can sign in with Google or your password.</>
          ) : (
            <>Not connected. Connect it to sign in with one click.</>
          )}
        </p>
      </div>
    </SettingsSection>
  );
}
