// components/admin/GenerateCreatorLinkDialog.tsx
"use client";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function GenerateCreatorLinkDialog() {
  const generate = useMutation(api.operator.generateCreatorToken);
  const emailEnabled = useQuery(api.email.emailEnabled);
  const sendInvite = useAction(api.email.sendCreatorInvite);
  const [link, setLink] = useState<string | null>(null);

  async function onGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string)?.trim();
    const sendEmail = fd.get("sendEmail") === "on";
    const { token } = await generate({ email: email || undefined });
    const url = `${window.location.origin}/join/${token}`;
    setLink(url);
    if (sendEmail && email) {
      const result = await sendInvite({ email, token });
      if (result.sent) {
        toast.success(`Invite emailed to ${email}.`);
      } else {
        toast.error("The link was created but the email could not be sent.");
      }
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        Generate creator link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate a creator invite link</DialogTitle>
        </DialogHeader>
        <form onSubmit={onGenerate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gen-email">Email (optional, locks the link to this address)</Label>
            <Input id="gen-email" name="email" type="email" />
          </div>
          {emailEnabled && (
            <div className="flex items-center gap-2">
              <input
                id="gen-send-email"
                name="sendEmail"
                type="checkbox"
                className="size-4 accent-primary"
              />
              <Label htmlFor="gen-send-email">Email this invite to the address above</Label>
            </div>
          )}
          <Button type="submit">Create link</Button>
        </form>
        {link && (
          <div className="space-y-2">
            <Label>Invite link</Label>
            <div className="flex gap-2">
              <Input readOnly value={link} />
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Copied.");
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
