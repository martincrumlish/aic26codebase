// app/(app)/projects/page.tsx — the example feature. See convex/projects.ts.
import { ProjectsList } from "@/components/projects/ProjectsList";

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-7 sm:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          An example feature to copy for your own app: create, edit, attach a file, delete.
        </p>
      </div>
      <ProjectsList />
    </div>
  );
}
