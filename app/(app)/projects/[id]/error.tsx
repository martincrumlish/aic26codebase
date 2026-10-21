"use client";
// app/(app)/projects/[id]/error.tsx — shown when the URL isn't a valid project
// id at all (the argument validator rejects it). A valid id that doesn't exist
// or isn't yours is handled inside ProjectDetail.
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ProjectError() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
      <h1 className="text-xl font-semibold">Project not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have been deleted, or the link is wrong.
      </p>
      <Link href="/projects" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
        Back to projects
      </Link>
    </div>
  );
}
