"use client";
// app/(app)/projects/[id]/error.tsx — shown when the URL isn't a valid project
// id at all (the argument validator rejects it). A valid id that doesn't exist
// or isn't yours is handled inside ProjectDetail.
import Link from "next/link";
import { FolderXIcon } from "lucide-react";
import { EmptyState, PageBody, PageHeader } from "@/components/app-shell/Page";
import { buttonVariants } from "@/components/ui/button";

export default function ProjectError() {
  return (
    <>
      <PageHeader title="Project not found" back={{ href: "/projects", label: "Projects" }} />
      <PageBody>
        <EmptyState
          icon={FolderXIcon}
          title="Nothing here"
          description="The link may be wrong."
          action={<Link href="/projects" className={buttonVariants({ variant: "outline" })}>Back to projects</Link>}
        />
      </PageBody>
    </>
  );
}
