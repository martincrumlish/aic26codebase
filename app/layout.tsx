// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "AI26 Codebase",
  description: "Author, present, and deliver guided mind maps.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body className="antialiased">
          <ConvexClientProvider>{children}</ConvexClientProvider>
          <Toaster richColors />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
