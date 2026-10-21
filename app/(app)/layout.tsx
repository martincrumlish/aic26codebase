import { AppShell } from "@/components/app-shell/AppShell";
import { getBrand } from "@/lib/brand.server";

// Shared shell (sidebar + account menu) for every signed-in page. Put a route
// outside the (app) group if it should render full-screen without the shell.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const brand = await getBrand();
  return (
    <AppShell logoUrl={brand.logoUrl} appName={brand.name}>
      {children}
    </AppShell>
  );
}
