// app/(app)/settings/profile/page.tsx
import { ProfileForm } from "@/components/settings/ProfileForm";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function ProfileSettingsPage() {
  return (
    <SettingsSection title="Profile" description="Your name and email.">
      <ProfileForm />
    </SettingsSection>
  );
}
