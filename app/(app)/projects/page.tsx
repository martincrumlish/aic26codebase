// app/(app)/projects/page.tsx — the example feature. See convex/projects.ts.
import { PageBody, PageHeader } from "@/components/app-shell/Page";
import { ProjectsList } from "@/components/projects/ProjectsList";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="An example feature to copy for your own app: create, edit, attach a file, delete."
      />
      <PageBody>
        <ProjectsList />
      </PageBody>
    </>
  );
}
