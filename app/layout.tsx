// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getBrand } from "@/lib/brand.server";

// The app's typefaces (self-hosted by next/font at build time). To use your
// own, swap these and keep the variable names.
const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return { title: brand.name, description: brand.description };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const brand = await getBrand();
  return (
    <ConvexAuthNextjsServerProvider>
      {/* suppressHydrationWarning: next-themes sets the theme class on <html>
          before React hydrates, which would otherwise warn. */}
      <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
        {brand.css && (
          <head>
            {/* Colours from Admin > Branding, in the page before it paints (no
                flash). brandCss only ever writes validated #rrggbb values. */}
            <style id="brand-colours" dangerouslySetInnerHTML={{ __html: brand.css }} />
          </head>
        )}
        <body className="antialiased">
          <ThemeProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
            <Toaster richColors />
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
