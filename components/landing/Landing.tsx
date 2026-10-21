// components/landing/Landing.tsx — the public home page signed-out visitors
// see at "/". A starting point for your own marketing page: the name and
// description come from lib/site.ts, the features from FEATURES below, and the
// preview is a screenshot of the app (public/brand/app-preview.png). Swap in
// your own copy and a screenshot of your product.
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CreditCardIcon, FolderIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { siteConfig } from "@/lib/site";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SiteFooter, SiteHeader } from "./SiteChrome";

// What the app does. These describe what's built in; replace them with your
// product's own.
const FEATURES = [
  {
    Icon: FolderIcon,
    title: "Projects",
    text: "Keep work organised in projects, each with notes and a file. Changes show up live on every device.",
  },
  {
    Icon: SparklesIcon,
    title: "AI chat",
    text: "Ask Claude, GPT, Gemini and more from one place. Conversations are saved so you can pick up where you left off.",
  },
  {
    Icon: CreditCardIcon,
    title: "Simple plans",
    text: "Start free. Upgrade when you need more, and manage or cancel your plan yourself at any time.",
  },
  {
    Icon: ShieldCheckIcon,
    title: "Secure sign-in",
    text: "Email and password or Google, with email confirmation and password reset built in.",
  },
];

export function Landing({ signupOpen }: { signupOpen: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-sidebar text-sidebar-foreground">
      <div className="relative overflow-hidden">
        {/* The same artwork as the sign-in page, fading in from the bottom-left. */}
        <Image
          src="/brand/auth-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="pointer-events-none object-cover object-[left_bottom] opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sidebar/40 via-transparent to-sidebar" aria-hidden="true" />
        <SiteHeader />

        <main className="relative">
          <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-8">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{siteConfig.name}</h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-sidebar-foreground/70">{siteConfig.description}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {signupOpen ? (
                  <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "px-5 shadow-lg shadow-primary/20")}>
                    Get started
                    <ArrowRightIcon />
                  </Link>
                ) : (
                  <p className="text-sm text-sidebar-foreground/60">Accounts are by invitation.</p>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-xl border border-sidebar-foreground/15 bg-sidebar-foreground/5 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-sm">
                <Image
                  src="/brand/app-preview.png"
                  alt={`A preview of the app: the ${siteConfig.name} dashboard`}
                  width={1120}
                  height={600}
                  priority
                  sizes="(min-width: 1024px) 640px, 100vw"
                  className="h-auto w-full rounded-lg"
                />
              </div>
            </div>
          </section>
        </main>
      </div>

      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight">Everything you need, already working.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-sidebar-foreground/10 bg-sidebar-foreground/[0.04] p-6 transition-colors hover:bg-sidebar-foreground/[0.07]">
              <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary/25 text-sidebar-foreground">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-sidebar-foreground/65">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </div>
  );
}
