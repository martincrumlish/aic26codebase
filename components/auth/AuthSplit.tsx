// components/auth/AuthSplit.tsx — the layout every account page uses (sign in,
// sign up, reset, join, activate, welcome), so they all look the same.
//
// Wide screens: the brand artwork with the logo on the left, the form on the
// right. Phones: a navy bar with the logo above the form.
import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { getBrand } from "@/lib/brand.server";
import { BrandBackdrop } from "@/components/landing/BrandBackdrop";

/** Images from Admin > Branding live in Convex storage; serve those as they are. */
const remote = (src: string) => !src.startsWith("/");

export async function AuthSplit({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const brand = await getBrand();
  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      {/* Brand panel: the sidebar colour, with the artwork on top. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground md:flex">
        <BrandBackdrop artworkUrl={brand.artworkUrl} sizes="50vw" />
        <span aria-hidden="true" />
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <Image
            src={brand.logoLargeUrl}
            alt={brand.name}
            width={600}
            height={125}
            priority
            unoptimized={remote(brand.logoLargeUrl)}
            className="h-14 w-auto max-w-xs object-contain"
          />
          <p className="max-w-xs text-sidebar-foreground/70">{brand.description}</p>
        </div>
        <p className="relative z-10 text-sm text-sidebar-foreground/40">
          © {new Date().getFullYear()} {brand.name}
        </p>
      </div>

      <div className="flex flex-col bg-background">
        {/* Phones: the logo in a sidebar-coloured bar, since the brand panel is hidden. */}
        <div className="flex h-14 items-center justify-center bg-sidebar md:hidden">
          <Link href="/">
            <Image
              src={brand.logoUrl}
              alt={brand.name}
              width={300}
              height={63}
              unoptimized={remote(brand.logoUrl)}
              className="h-6 w-auto max-w-48 object-contain"
            />
          </Link>
        </div>
        <div className="px-6 pt-6 md:px-12 md:pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" />
            Back to home
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-6 py-8 md:items-center md:px-12 md:py-10">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
