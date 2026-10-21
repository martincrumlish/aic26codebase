// app/reset/page.tsx
import Link from "next/link";
import { ResetForm } from "@/components/auth/ResetForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export default function ResetPage() {
  return (
    <AuthSplit title="Reset your password" description="Get back into your account.">
      <ResetForm />
      <Link href="/signin" className="block text-center text-sm text-muted-foreground hover:underline">
        Back to sign in
      </Link>
    </AuthSplit>
  );
}
