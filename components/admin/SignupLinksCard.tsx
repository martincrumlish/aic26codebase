// components/admin/SignupLinksCard.tsx — active standing signup links.
// Links never expire; rotation is manual: revoke here, generate a new one.
"use client";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SignupLinksCard() {
  const links = useQuery(api.operator.listSignupTokens, {});
  const revoke = useMutation(api.operator.revokeSignupToken);

  if (links === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active signup links. Generate one with the button above — links stay
        live until you revoke them.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {links.map((link) => {
        const url = `${window.location.origin}/join/${link.token}`;
        return (
          <li key={link._id} className="flex items-center gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <span className="shrink-0 text-xs text-muted-foreground">
              {link.email ? `locked to ${link.email} · ` : ""}
              {link.usedCount} signup{link.usedCount === 1 ? "" : "s"}
            </span>
            <Button
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
                await revoke({ tokenId: link._id });
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
