// app/(app)/dashboard/page.tsx — the signed-in home page. It's a starting
// point (components/dashboard/Overview.tsx): replace it with your product's
// main screen, keeping the loading pattern (useQuery returns undefined while
// loading, so show skeletons, never a flash of "empty").
import { Overview } from "@/components/dashboard/Overview";

export default function DashboardPage() {
  return <Overview />;
}
