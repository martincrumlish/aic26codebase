// app/activate/[token]/page.tsx
import { ActivateForm } from "@/components/auth/ActivateForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <AuthSplit title="Activate your account" description="Your account is ready. Choose a password to finish.">
      <ActivateForm token={token} />
    </AuthSplit>
  );
}
