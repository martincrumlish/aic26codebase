// components/settings/AiForm.tsx — BYOK OpenRouter key card.
"use client";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AiForm() {
  const status = useQuery(api.ai.getAiStatus);
  const setKey = useAction(api.ai.setOpenRouterKey);
  const clearKey = useMutation(api.ai.clearOpenRouterKey);
  const [submitting, setSubmitting] = useState(false);

  if (status === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
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
    <div className="max-w-sm space-y-4">
      <p className="text-sm text-muted-foreground">
        {status.source === "own" ? (
          <>AI features are enabled with your key ending in <code>…{status.last4}</code>.</>
        ) : status.source === "app" ? (
          <>AI features are enabled with the app&apos;s built-in key. Add your own to use your OpenRouter account instead.</>
        ) : (
          <>AI features are disabled. Paste an OpenRouter API key to enable them.</>
        )}
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-key">OpenRouter API key</Label>
          <Input
            id="ai-key"
            name="key"
            type="password"
            autoComplete="off"
            placeholder="sk-or-v1-…"
            required
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            Save &amp; verify
          </Button>
          {status.source === "own" && (
            <Button type="button" variant="outline" disabled={submitting} onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
