// components/landing/BrandBackdrop.tsx — the background of the sign-in panel
// and the landing hero: the brand's artwork if it has one, otherwise a soft
// highlight in the brand's own colours. Fills its (relative) parent.
import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandBackdrop({
  artworkUrl,
  sizes,
  className,
}: {
  artworkUrl: string | null;
  sizes: string;
  className?: string;
}) {
  if (!artworkUrl) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,var(--color-sidebar-primary)_0%,transparent_60%)] opacity-25",
          className,
        )}
      />
    );
  }
  return (
    <Image
      src={artworkUrl}
      alt=""
      fill
      priority
      sizes={sizes}
      // Uploaded artwork comes from Convex storage; serve it as it is.
      unoptimized={!artworkUrl.startsWith("/")}
      className={cn("pointer-events-none object-cover object-[left_bottom]", className)}
    />
  );
}
