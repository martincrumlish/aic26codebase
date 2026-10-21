// components/landing/Landing.tsx — the public home page signed-out visitors
// see at "/". A deliberately plain starting point: replace it with your own
// marketing page. Name and description come from lib/site.ts.
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Landing({ signupOpen }: { signupOpen: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{siteConfig.name}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{siteConfig.description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {signupOpen && (
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "px-6")}>
              Get started
            </Link>
          )}
          <Link
            href="/signin"
            className={cn(buttonVariants({ size: "lg", variant: signupOpen ? "outline" : "default" }), "px-6")}
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
