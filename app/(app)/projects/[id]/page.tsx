// app/(app)/projects/[id]/page.tsx
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { ProjectDetail } from "@/components/projects/ProjectDetail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl px-4 py-7 sm:px-8">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All projects
      </Link>
      <ProjectDetail projectId={id} />
    </div>
  );
}
