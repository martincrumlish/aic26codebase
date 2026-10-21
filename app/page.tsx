// app/page.tsx — signed-in users go straight to the dashboard; everyone else
// sees the public landing page.
import { redirect } from "next/navigation";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { Landing } from "@/components/landing/Landing";

export default async function Home() {
  if (await isAuthenticatedNextjs()) redirect("/dashboard");
  return <Landing />;
}
