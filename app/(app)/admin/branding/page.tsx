// app/(app)/admin/branding/page.tsx — Admin > Branding.
"use client";
import { useQuery } from "convex/react";
import { ShieldXIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EmptyState, PageBody, PageHeader } from "@/components/app-shell/Page";
import { BrandingForm } from "@/components/admin/BrandingForm";

const BACK = { href: "/admin", label: "Admin" };

export default function BrandingPage() {
  const me = useQuery(api.users.currentUser, {});

  // Friendly UI guard. The real enforcement is server-side: every branding
  // change calls requireAdmin.
  if (me !== undefined && (me === null || me.role !== "admin")) {
    return (
      <>
        <PageHeader title="Branding" back={BACK} />
        <PageBody>
          <EmptyState icon={ShieldXIcon} title="Access denied" description="This page is for admins only." />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Branding"
        description="Your app's name, colours, logo and sign-in artwork, on every page."
        back={BACK}
      />
      <PageBody>{me === undefined ? <div className="h-96 animate-pulse rounded-xl bg-muted" /> : <BrandingForm />}</PageBody>
    </>
  );
}
