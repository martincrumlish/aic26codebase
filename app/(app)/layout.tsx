import { AppShell } from "@/components/app-shell/AppShell";

// Shared shell (sidebar + account menu) for every signed-in page. Put a route
// outside the (app) group if it should render full-screen without the shell.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
