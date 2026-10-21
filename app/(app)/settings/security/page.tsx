// app/(app)/settings/security/page.tsx — the ways you sign in.
import { Suspense } from "react";
import { GoogleConnect } from "@/components/settings/GoogleConnect";
import { SecurityForm } from "@/components/settings/SecurityForm";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function SecuritySettingsPage() {
  return (
    <>
      <SettingsSection title="Password" description="Change the password you use to sign in.">
        <SecurityForm />
      </SettingsSection>
      {/* Renders nothing until Google is set up. Suspense: reads ?connect=google. */}
      <Suspense fallback={null}>
        <GoogleConnect />
      </Suspense>
    </>
  );
}
