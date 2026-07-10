// components/admin/WebhookCard.tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const info = useQuery(api.operator.getWebhookInfo, {});
  const rotate = useMutation(api.operator.rotateWebhookSecret);
  if (info === undefined) return null;
  const url = provisionUrl();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provisioning webhook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Endpoint URL (POST, HMAC-SHA256 in <code>x-app-signature</code>)</Label>
          <div className="flex gap-2">
            <Input readOnly value={url} />
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
        <div>
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
          <p className="mt-2 text-xs text-muted-foreground">
            The secret value lives in the Convex env var. After rotating here, set the new value with{" "}
            <code>npx convex env set PROVISION_WEBHOOK_SECRET …</code> and update the sender.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
