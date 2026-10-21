// components/settings/AiForm.tsx — BYOK OpenRouter key card.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./SettingsSection";

export function AiForm() {
  const status = useQuery(api.ai.getAiStatus);
  const setKey = useAction(api.ai.setOpenRouterKey);
  const clearKey = useMutation(api.ai.clearOpenRouterKey);
  const [submitting, setSubmitting] = useState(false);

  if (status === undefined) {
    return <SettingsSection title="OpenRouter key" description="Loading…" />;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const key = (new FormData(form).get("key") as string).trim();
    if (!key) return;
    setSubmitting(true);
    try {
      const { last4 } = await setKey({ key });
      toast.success(`Key verified and saved (…${last4}).`);
      form.reset();
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as string) : "Could not verify that key.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove() {
    setSubmitting(true);
    try {
      await clearKey({});
      toast.success("Your OpenRouter key was removed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSection
      title="OpenRouter key"
      description="AI chat runs on OpenRouter. Use your own key to pay for your own usage."
      onSubmit={onSubmit}
      hint={
        <>
          Get a key at{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">
            openrouter.ai/keys
          </a>
          .
        </>
      }
      footer={
        <>
          {status.source === "own" && (
            <Button type="button" variant="outline" disabled={submitting} onClick={onRemove}>
              Remove
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            Save &amp; verify
          </Button>
        </>
      }
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border px-4 py-3",
          status.enabled ? "border-emerald-600/20 bg-emerald-600/5" : "bg-muted/40",
        )}
      >
        {status.enabled ? (
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-sm text-muted-foreground">
          {status.source === "own" ? (
            <>AI features are enabled with your key ending in <code>…{status.last4}</code>.</>
          ) : status.source === "app" ? (
            <>AI features are enabled with the app&apos;s built-in key. Add your own to use your OpenRouter account instead.</>
          ) : status.appKeyNeedsPro ? (
            <>
              The built-in AI is included with Pro.{" "}
              <Link href="/pricing" className="font-medium text-foreground underline">Upgrade</Link>, or paste
              your own OpenRouter API key to use AI on the Free plan.
            </>
          ) : (
            <>AI features are disabled. Paste an OpenRouter API key to enable them.</>
          )}
        </p>
      </div>

      <div className="max-w-md space-y-2">
        <Label htmlFor="ai-key">{status.source === "own" ? "Replace your key" : "OpenRouter API key"}</Label>
        <Input
          id="ai-key"
          name="key"
          type="password"
          autoComplete="off"
          placeholder="sk-or-v1-…"
          required
        />
      </div>
    </SettingsSection>
  );
}
