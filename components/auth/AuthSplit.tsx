import Image from "next/image";

/**
 * Shared full-height auth layout used by every auth page (sign-in, reset, join,
 * activate) so they all look the same. A full-bleed branded image panel on the
 * left (extends to the left edge) with the logo centred on top, and the form on
 * the right (extends to the right edge). The form hugs the centre divider.
 * Collapses to just the form on small screens.
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      {/* Brand panel — full-bleed background image to the left edge; logo centred
          on top. The #03091b fill is the fallback shown while the image loads. */}
      <div className="relative hidden overflow-hidden bg-[#03091b] p-12 text-primary-foreground md:flex md:items-center md:justify-center">
        <Image
          src="/brand/auth-bg.png"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-[left_bottom]"
        />
        <Image
          src="/brand/mid-transparent.png"
          alt="Brand"
          width={600}
          height={125}
          priority
          className="relative z-10 h-16 w-auto"
        />
      </div>

      {/* Form panel — full-bleed to the right edge; content sits near the divider */}
      <div className="flex items-center justify-center bg-background p-8 md:justify-start md:p-12">
        <div className="w-full max-w-sm space-y-6">{children}</div>
      </div>
    </main>
  );
}
