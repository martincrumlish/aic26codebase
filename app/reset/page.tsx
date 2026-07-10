// app/reset/page.tsx
import { ResetForm } from "@/components/auth/ResetForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export default function ResetPage() {
  return (
    <AuthSplit>
      <h1 className="text-center text-2xl font-semibold">Reset your password</h1>
      <ResetForm />
      <a
        href="/signin"
        className="block text-center text-sm text-muted-foreground hover:underline"
      >
        Back to sign in
      </a>
    </AuthSplit>
  );
}
