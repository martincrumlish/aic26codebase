// components/auth/SignOutButton.tsx
"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className={className}
      onClick={() => {
        void signOut().then(() => router.push("/signin"));
      }}
    >
      Sign out
    </Button>
  );
}
