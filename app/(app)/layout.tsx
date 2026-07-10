import { AppShell } from "@/components/app-shell/AppShell";

// Shared shell for all authenticated, chrome-bearing pages (dashboard,
// templates, settings, admin). The editor and public viewer routes live
// outside this group and render full-screen with no shell.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
