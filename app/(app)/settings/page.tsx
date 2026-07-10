// app/settings/page.tsx
import { AiForm } from "@/components/settings/AiForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { SecurityForm } from "@/components/settings/SecurityForm";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-7">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your profile and account security.
        </p>
      </div>

      <div className="space-y-10">
        <section>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
            Your name and email.
          </p>
          <ProfileForm />
        </section>

        <hr className="border-border" />

        <section>
          <h2 className="text-lg font-semibold">Password</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
            Change the password you use to sign in.
          </p>
          <SecurityForm />
        </section>

        <hr className="border-border" />

        <section>
          <h2 className="text-lg font-semibold">AI</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
            Bring your own OpenRouter key for AI features.
          </p>
          <AiForm />
        </section>
      </div>
    </div>
  );
}
