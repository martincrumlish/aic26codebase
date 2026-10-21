// components/admin/WebhookCard.tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function provisionUrl(): string {
  // HTTP actions live on the .convex.site domain (NOT .convex.cloud).
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  const site = cloud.replace(".convex.cloud", ".convex.site");
  return `${site}/provision`;
}

export function WebhookCard() {
  const info = useQuery(api.admin.getWebhookInfo, {});
  const rotate = useMutation(api.admin.rotateWebhookSecret);
  if (info === undefined) return null;
  const url = provisionUrl();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provisioning webhook</CardTitle>
        <CardDescription>Lets another system (like a payment platform) create accounts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Endpoint URL (POST, HMAC-SHA256 in <code>x-app-signature</code>)</Label>
          <div className="flex gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Copied.");
              }}
            >
              Copy
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label>Signing secret</Label>
          <Badge variant={info.secretSet ? "secondary" : "destructive"}>
            {info.secretSet ? "configured" : "not set"}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex-wrap justify-between">
        <p className="text-xs text-muted-foreground">
          The secret lives in a Convex env var: after rotating, run{" "}
          <code>npx convex env set PROVISION_WEBHOOK_SECRET …</code> and update the sender.
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            await rotate({});
            toast.message(
              "Rotation recorded. Now run: npx convex env set PROVISION_WEBHOOK_SECRET <new-secret>",
            );
          }}
        >
          Rotate secret
        </Button>
      </CardFooter>
    </Card>
  );
}
