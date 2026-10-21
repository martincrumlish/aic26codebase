// app/signup/page.tsx
import { SignUpForm } from "@/components/auth/SignUpForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export default function SignUpPage() {
  return (
    <AuthSplit>
      <h1 className="text-center text-2xl font-semibold">Create your account</h1>
      <SignUpForm />
    </AuthSplit>
  );
}
