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
    <AuthSplit>
      <h1 className="text-center text-2xl font-semibold">Create your account</h1>
      <JoinForm token={token} />
    </AuthSplit>
  );
}
