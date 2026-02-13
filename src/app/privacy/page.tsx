import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container pb-16 pt-12">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
          <p className="text-sm text-muted-foreground">
            ExamForge stores your profile, study plans, quiz results, and group chat messages to
            power core features. You control notification preferences, and you can request account
            deletion.
          </p>
          <p className="text-sm text-muted-foreground">
            For Nigeria-first compliance, design aligns with NDPR principles; for global expansion,
            it also supports GDPR-friendly practices (data minimization, access, deletion).
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

