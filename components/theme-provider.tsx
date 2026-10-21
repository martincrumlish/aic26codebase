"use client";

// Light/dark mode via a `.dark` class on <html> (see the .dark tokens in
// app/globals.css). Defaults to the visitor's system setting.
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
