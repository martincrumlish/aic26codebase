// app/(app)/settings/ai/page.tsx
import { AiForm } from "@/components/settings/AiForm";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function AiSettingsPage() {
  return (
    <SettingsSection title="AI" description="Bring your own OpenRouter key for AI chat.">
      <AiForm />
    </SettingsSection>
  );
}
