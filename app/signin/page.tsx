// app/signin/page.tsx
import { SignInForm } from "@/components/auth/SignInForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export default function SignInPage() {
  return (
    <AuthSplit>
      <h1 className="text-center text-2xl font-semibold">Sign in</h1>
      <SignInForm />
    </AuthSplit>
  );
}
