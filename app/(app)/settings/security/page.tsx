// app/(app)/settings/security/page.tsx — the ways you sign in.
import { Suspense } from "react";
import { GoogleConnect } from "@/components/settings/GoogleConnect";
import { SecurityForm } from "@/components/settings/SecurityForm";

export default function SecuritySettingsPage() {
  return (
    <>
      <SecurityForm />
      {/* Renders nothing until Google is set up. Suspense: reads ?connect=google. */}
      <Suspense fallback={null}>
        <GoogleConnect />
      </Suspense>
    </>
  );
}
