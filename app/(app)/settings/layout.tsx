// app/(app)/settings/layout.tsx — shared by every Settings page: the title
// and the section menu (components/settings/SettingsNav.tsx).
import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <SettingsNav />
        <div className="min-w-0 max-w-2xl flex-1 space-y-10">{children}</div>
      </div>
    </div>
  );
}
