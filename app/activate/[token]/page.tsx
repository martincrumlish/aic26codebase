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
    <AuthSplit>
      <h1 className="text-center text-2xl font-semibold">Activate your account</h1>
      <ActivateForm token={token} />
    </AuthSplit>
  );
}
