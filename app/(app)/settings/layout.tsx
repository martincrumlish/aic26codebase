// app/(app)/settings/layout.tsx — shared by every Settings page: the page
// header and the section menu (components/settings/SettingsNav.tsx).
import { PageBody, PageHeader } from "@/components/app-shell/Page";
import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, plan and how you sign in." />
      <PageBody className="flex flex-col gap-6 md:flex-row md:gap-10">
        <SettingsNav />
        <div className="min-w-0 max-w-3xl flex-1 space-y-6">{children}</div>
      </PageBody>
    </>
  );
}
