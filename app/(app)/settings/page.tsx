// app/(app)/settings/page.tsx — /settings opens the first section. Older
// return links (?billing=..., ?connect=google) go to the section they belong to.
import { redirect } from "next/navigation";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  if (params.billing) redirect(`/settings/billing?billing=${encodeURIComponent(params.billing)}`);
  if (params.connect) redirect(`/settings/security?connect=${encodeURIComponent(params.connect)}`);
  redirect("/settings/profile");
}
