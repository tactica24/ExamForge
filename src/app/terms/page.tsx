import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function TermsPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container pb-16 pt-12">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Terms</h1>
          <p className="text-sm text-muted-foreground">
            ExamForge provides practice content and study planning. It does not guarantee outcomes
            and is not an official examination body.
          </p>
          <p className="text-sm text-muted-foreground">
            You are responsible for your use of the service. Abuse, cheating services, harassment,
            or sharing illegal copyrighted materials is prohibited. Group chats are moderated.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

