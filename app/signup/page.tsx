// app/signup/page.tsx
import { SignUpForm } from "@/components/auth/SignUpForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export default function SignUpPage() {
  return (
    <AuthSplit title="Create your account" description="It only takes a minute.">
      <SignUpForm />
    </AuthSplit>
  );
}
