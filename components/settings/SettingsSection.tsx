// components/settings/SettingsSection.tsx — one card on a Settings page:
// title and description, the fields, and a footer bar for the main action.
// Pass `onSubmit` to make the whole card a form (so a footer button can be
// its submit button).
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsSection({
  title,
  description,
  children,
  footer,
  hint,
  onSubmit,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons, shown on the right of the footer bar. */
  footer?: React.ReactNode;
  /** A short note, shown on the left of the footer bar. */
  hint?: React.ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const card = (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {children && <CardContent className="space-y-4">{children}</CardContent>}
      {(footer || hint) && (
        <CardFooter className="flex-wrap justify-between">
          <p className="text-sm text-muted-foreground">{hint}</p>
          <div className="flex flex-wrap items-center gap-2">{footer}</div>
        </CardFooter>
      )}
    </Card>
  );
  return onSubmit ? <form onSubmit={onSubmit}>{card}</form> : card;
}
