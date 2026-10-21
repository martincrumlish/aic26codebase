// components/admin/SignupLinksCard.tsx — active standing signup links.
// Links never expire; rotation is manual: revoke here, generate a new one.
"use client";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SignupLinksCard() {
  const links = useQuery(api.admin.listSignupLinks, {});
  const revoke = useMutation(api.admin.revokeSignupLink);

  if (links === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (links.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No active signup links. Use Generate signup link at the top of the page to make one.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {links.map((link) => {
        const url = `${window.location.origin}/join/${link.token}`;
        return (
          <li key={link._id} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Input readOnly value={url} className="w-full font-mono text-xs sm:w-auto sm:flex-1" />
            <span className="text-xs text-muted-foreground sm:shrink-0">
              {link.email ? `locked to ${link.email} · ` : ""}
              {link.usedCount} signup{link.usedCount === 1 ? "" : "s"}
            </span>
            <Button
              className="ml-auto sm:ml-0"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Copied.");
              }}
            >
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await revoke({ linkId: link._id });
                toast.success("Link revoked. Anyone holding it can no longer sign up.");
              }}
            >
              Revoke
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
