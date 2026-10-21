// components/settings/SettingsSection.tsx — a titled block inside a Settings page.
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}
