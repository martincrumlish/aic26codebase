"use client";

// Dashboard — boilerplate placeholder. Replace the card grid with your app's
// primary resource list. Keep the loading pattern: `useQuery` returns
// `undefined` while loading, so render a skeleton — never flash an empty state.
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function DashboardPage() {
  const me = useQuery(api.users.currentUser, {});
  const loading = me === undefined;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {loading ? (
        <div
          data-testid="dashboard-loading"
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {me?.email ?? "unknown"}
            </span>
            {me?.role ? ` — role: ${me.role}` : null}. Build your app here.
          </p>
        </div>
      )}
    </div>
  );
}
