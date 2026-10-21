// app/join/[token]/page.tsx
import { JoinForm } from "@/components/auth/JoinForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <AuthSplit title="Create your account" description="You've been invited. Choose your email and a password.">
      <JoinForm token={token} />
    </AuthSplit>
  );
}
