// app/signin/page.tsx
import { SignInForm } from "@/components/auth/SignInForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ via?: string }>;
}) {
  // A successful Google sign-in is sent on to the dashboard by middleware.ts,
  // so landing here with ?via=google means it didn't complete.
  const { via } = await searchParams;
  return (
    <AuthSplit>
      <h1 className="text-center text-2xl font-semibold">Sign in</h1>
      <SignInForm googleReturn={via === "google"} />
    </AuthSplit>
  );
}
