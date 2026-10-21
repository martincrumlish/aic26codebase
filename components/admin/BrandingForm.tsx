// components/admin/BrandingForm.tsx — Admin > Branding: name, description,
// colours, logo and sign-in artwork, with a live preview. Saved values apply
// to every page (convex/branding.ts, lib/brand.server.ts); anything left empty
// uses the defaults in code.
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DEFAULT_BRAND, DEFAULT_COLORS, isHexColor, readableTextOn } from "@/lib/brandTheme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Kind = "logo" | "artwork";

const errorText = (err: unknown, fallback: string) =>
  err instanceof ConvexError ? (err.data as string) : fallback;

function ColorField({
  id,
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const invalid = value !== "" && !isHexColor(value);
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-hex`}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={isHexColor(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1 shadow-xs"
        />
        <Input
          id={`${id}-hex`}
          aria-label={`${label} hex`}
          value={value}
          placeholder={`${fallback} (default)`}
          onChange={(e) => onChange(e.target.value.trim())}
          aria-invalid={invalid || undefined}
          className="font-mono"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Use default ${label.toLowerCase()}`}
          disabled={value === ""}
          onClick={() => onChange("")}
        >
          Default
        </Button>
      </div>
      <p className={invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {invalid ? "Use #rrggbb, e.g. #1d4ed8." : hint}
      </p>
    </div>
  );
}

export function BrandingForm() {
  const saved = useQuery(api.branding.get, {});
  const update = useMutation(api.branding.update);
  const generateUploadUrl = useMutation(api.branding.generateUploadUrl);
  const setImage = useMutation(api.branding.setImage);
  const removeImage = useMutation(api.branding.removeImage);
  const reset = useMutation(api.branding.reset);
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Start from what's saved (once; later saves don't overwrite your edits).
  useEffect(() => {
    if (saved && !loaded) {
      setName(saved.name ?? "");
      setDescription(saved.description ?? "");
      setBrandColor(saved.brandColor ?? "");
      setPrimaryColor(saved.primaryColor ?? "");
      setLoaded(true);
    }
  }, [saved, loaded]);

  if (saved === undefined) return <div className="h-96 animate-pulse rounded-xl bg-muted" aria-busy="true" />;

  const colorsValid = [brandColor, primaryColor].every((c) => c === "" || isHexColor(c));

  async function run(work: () => Promise<void>, fallback: string) {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      toast.error(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const onSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void run(async () => {
      await update({
        name: name.trim() || null,
        description: description.trim() || null,
        brandColor: brandColor || null,
        primaryColor: primaryColor || null,
      });
      toast.success("Branding saved.");
      router.refresh(); // re-render the server parts (colours, sidebar logo)
    }, "Couldn't save the branding.");
  };

  const onUpload = (kind: Kind) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await run(async () => {
      const url = await generateUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const result = await setImage({ kind, storageId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(kind === "logo" ? "Logo updated." : "Artwork updated.");
      router.refresh();
    }, "Couldn't upload the image.");
  };

  const onRemove = (kind: Kind) =>
    void run(async () => {
      await removeImage({ kind });
      router.refresh();
    }, "Couldn't remove the image.");

  const onReset = () =>
    void run(async () => {
      await reset({});
      setName("");
      setDescription("");
      setBrandColor("");
      setPrimaryColor("");
      setConfirmReset(false);
      toast.success("Branding reset to the defaults.");
      router.refresh();
    }, "Couldn't reset the branding.");

  // What the preview shows: your edits, falling back to the defaults.
  const preview = {
    name: name.trim() || DEFAULT_BRAND.name,
    brand: isHexColor(brandColor) ? brandColor : DEFAULT_COLORS.brand,
    primary: isHexColor(primaryColor) ? primaryColor : DEFAULT_COLORS.primary,
    logo: saved.logoUrl ?? DEFAULT_BRAND.logoUrl,
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <form onSubmit={onSave}>
          <Card>
            <CardHeader>
              <CardTitle>Name and colours</CardTitle>
              <CardDescription>Leave anything empty to use the default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brand-name">App name</Label>
                  <Input
                    id="brand-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={DEFAULT_BRAND.name}
                    maxLength={60}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-description">Description</Label>
                  <Input
                    id="brand-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={DEFAULT_BRAND.description}
                    maxLength={160}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  id="brand-color"
                  label="Brand colour"
                  hint="The sidebar and the public pages."
                  value={brandColor}
                  fallback={DEFAULT_COLORS.brand}
                  onChange={setBrandColor}
                />
                <ColorField
                  id="primary-color"
                  label="Button colour"
                  hint="Buttons, links and highlights."
                  value={primaryColor}
                  fallback={DEFAULT_COLORS.primary}
                  onChange={setPrimaryColor}
                />
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <p className="text-sm text-muted-foreground">Text colours are picked automatically to stay readable.</p>
              <Button type="submit" disabled={busy || !colorsValid}>Save changes</Button>
            </CardFooter>
          </Card>
        </form>

        <div className="grid gap-6 sm:grid-cols-2">
          <ImageCard
            kind="logo"
            title="Logo"
            description="PNG, JPEG, WebP or SVG, up to 1 MB. Shown on the brand colour."
            url={saved.logoUrl}
            fallbackUrl={DEFAULT_BRAND.logoUrl}
            background={preview.brand}
            busy={busy}
            onUpload={onUpload("logo")}
            onRemove={() => onRemove("logo")}
          />
          <ImageCard
            kind="artwork"
            title="Sign-in artwork"
            description="Behind the sign-in panel and the landing page. Up to 4 MB."
            url={saved.artworkUrl}
            // The default artwork suits the default brand colour only.
            fallbackUrl={isHexColor(brandColor) ? null : DEFAULT_BRAND.artworkUrl}
            background={preview.brand}
            busy={busy}
            onUpload={onUpload("artwork")}
            onRemove={() => onRemove("artwork")}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset</CardTitle>
            <CardDescription>Go back to the name, colours and images set in the code.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-end">
            <Button variant="destructive" disabled={busy} onClick={() => setConfirmReset(true)}>
              Reset to defaults
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Updates as you edit. Save to apply.</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandPreview {...preview} />
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the branding?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The name, colours, logo and artwork go back to the defaults. Uploaded images are deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={onReset}>Reset everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageCard(props: {
  kind: Kind;
  title: string;
  description: string;
  url: string | null;
  /** What shows when nothing's uploaded (null: just the brand colour). */
  fallbackUrl: string | null;
  background: string;
  busy: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const inputId = `upload-${props.kind}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex h-28 items-center justify-center overflow-hidden rounded-lg border"
          style={{ background: props.background }}
        >
          {(props.url ?? props.fallbackUrl) && (
            // eslint-disable-next-line @next/next/no-img-element -- previews any URL, including Convex storage
            <img
              src={(props.url ?? props.fallbackUrl)!}
              alt=""
              className={props.kind === "logo" ? "max-h-10 max-w-[80%] object-contain" : "h-full w-full object-cover"}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {props.url ? "Your upload." : props.fallbackUrl ? "Using the default." : "None: your brand colour shows instead."}
        </p>
        <div className="space-y-2">
          <Label htmlFor={inputId}>{props.kind === "logo" ? "Upload a logo" : "Upload sign-in artwork"}</Label>
          <Input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            disabled={props.busy}
            onChange={props.onUpload}
            className="h-auto py-1.5 text-muted-foreground file:mr-3 file:h-7 file:rounded-md file:bg-muted file:px-3 file:text-foreground"
          />
        </div>
      </CardContent>
      {props.url && (
        <CardFooter className="justify-end">
          <Button variant="ghost" size="sm" disabled={props.busy} onClick={props.onRemove}>
            Use the default
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

/** A small mock of the app in the chosen colours (inline styles: they're live edits). */
function BrandPreview({ name, brand, primary, logo }: { name: string; brand: string; primary: string; logo: string }) {
  const fg = readableTextOn(brand);
  return (
    <div className="overflow-hidden rounded-lg border shadow-xs">
      <div className="flex h-56">
        <div className="flex w-24 shrink-0 flex-col gap-2 p-2.5" style={{ background: brand, color: fg }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- previews any URL */}
          <img src={logo} alt="" className="mb-1 h-4 w-auto max-w-full object-contain object-left" />
          <span className="h-5 rounded" style={{ background: `color-mix(in oklab, ${brand}, ${fg} 16%)` }} />
          <span className="h-2 w-12 rounded-full opacity-50" style={{ background: fg }} />
          <span className="h-2 w-10 rounded-full opacity-50" style={{ background: fg }} />
        </div>
        <div className="flex-1 space-y-2 bg-canvas p-3">
          <p className="truncate text-xs font-semibold">{name}</p>
          <div className="space-y-1.5 rounded-md border bg-card p-2">
            <span className="block h-1.5 w-3/4 rounded-full bg-muted" />
            <span className="block h-1.5 w-1/2 rounded-full bg-muted" />
          </div>
          <span
            className="inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-medium"
            style={{ background: primary, color: readableTextOn(primary) }}
          >
            Button
          </span>
          <p className="text-[10px] font-medium" style={{ color: primary }}>A link</p>
        </div>
      </div>
    </div>
  );
}
