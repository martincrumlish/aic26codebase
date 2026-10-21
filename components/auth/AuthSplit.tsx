// components/auth/AuthSplit.tsx — the layout every account page uses (sign in,
// sign up, reset, join, activate, welcome), so they all look the same.
//
// Wide screens: the brand artwork with the logo on the left, the form on the
// right. Phones: a navy bar with the logo above the form.
import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function AuthSplit({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      {/* Brand panel. The #03091b fill shows while the image loads. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#03091b] p-10 text-white md:flex">
        <Image
          src="/brand/auth-bg.png"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-[left_bottom]"
        />
        <span aria-hidden="true" />
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <Image
            src="/brand/mid-transparent.png"
            alt={siteConfig.name}
            width={600}
            height={125}
            priority
            className="h-14 w-auto"
          />
          <p className="max-w-xs text-white/70">{siteConfig.description}</p>
        </div>
        <p className="relative z-10 text-sm text-white/40">
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
      </div>

      <div className="flex flex-col bg-background">
        {/* Phones: the logo in a navy bar, since the brand panel is hidden. */}
        <div className="flex h-14 items-center justify-center bg-sidebar md:hidden">
          <Link href="/">
            <Image
              src="/brand/small-transparent.png"
              alt={siteConfig.name}
              width={300}
              height={63}
              className="h-6 w-auto"
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
