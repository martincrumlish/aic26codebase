// app/page.tsx — signed-in users go straight to the dashboard; everyone else
// sees the public landing page.
import { redirect } from "next/navigation";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Landing } from "@/components/landing/Landing";
import { getBrand } from "@/lib/brand.server";

export default async function Home() {
  if (await isAuthenticatedNextjs()) redirect("/dashboard");
  const [mode, brand] = await Promise.all([fetchQuery(api.signup.mode, {}), getBrand()]);
  return <Landing signupOpen={mode === "open"} brand={brand} />;
}
