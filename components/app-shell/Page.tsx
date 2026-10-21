// components/app-shell/Page.tsx — the frame every signed-in page uses:
//
//   <PageHeader title="Projects" description="..." actions={<Button />} />
//   <PageBody>...cards...</PageBody>
//
// The header is a white band with the title and the page's main actions; the
// body sits on the grey canvas (AppShell), where cards stand out. Keeping every
// page on this frame is what makes the app feel consistent.
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const WIDTH = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons for the page's main actions, shown on the right. */
  actions?: React.ReactNode;
  /** A link back up a level, shown above the title. */
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cn("border-b bg-card", className)}>
      <div className={cn(WIDTH, "flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between")}>
        <div className="min-w-0">
          {back && (
            <Link
              href={back.href}
              className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeftIcon className="size-4" />
              {back.label}
            </Link>
          )}
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(WIDTH, "py-6 sm:py-8", className)}>{children}</div>;
}

/** A centred message for empty lists and not-found pages, inside a card. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
