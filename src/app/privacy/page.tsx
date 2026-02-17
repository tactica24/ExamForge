import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const privacyPrinciples = [
  "Lawful, fair, and transparent processing",
  "Purpose limitation and data minimization",
  "Accuracy, storage limitation, and accountability",
  "Security safeguards, access controls, and auditability"
];

const rights = [
  "Request access to personal data we hold about you",
  "Correct inaccurate or incomplete profile data",
  "Request deletion of your account and related personal data",
  "Object to or restrict specific processing where applicable",
  "Request export/portability of your account data",
  "Withdraw consent for optional communications"
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container pb-16 pt-12">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">
              ACE NAIJA is designed with practical privacy controls to support modern expectations across
              NDPR-aligned, GDPR/UK GDPR-style, and other global data protection principles.
            </p>
            <p className="text-sm text-muted-foreground">
              We process only the data needed to provide exam preparation features, improve learning outcomes,
              secure accounts, and operate the service responsibly.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">1) Privacy principles we apply</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {privacyPrinciples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">2) Data we collect</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Account data (name, email, optional phone, auth metadata).</li>
              <li>Learning data (exam preferences, study plans, quiz attempts, scores, streaks, progress trends).</li>
              <li>Community data (group messages, participation, and moderation events).</li>
              <li>Billing data needed for subscription state and transaction verification.</li>
              <li>Technical and security data (logs, device/browser info, and anti-abuse signals).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">3) How we use data</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Deliver core product features (planning, quizzes, analytics, reminders, and groups).</li>
              <li>Personalize practice and recommendations based on performance patterns.</li>
              <li>Protect users and platform integrity, including abuse prevention and moderation.</li>
              <li>Operate subscriptions, payment confirmation, and support workflows.</li>
              <li>Meet legal, regulatory, and incident-response obligations where applicable.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">4) Legal bases and consent</h2>
            <p className="text-sm text-muted-foreground">
              Depending on jurisdiction, we rely on contract performance, legitimate interests, consent,
              and legal obligations. Optional communication channels can be managed in your notification settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">5) Sharing, processors, and transfers</h2>
            <p className="text-sm text-muted-foreground">
              We use trusted processors for infrastructure, authentication, storage, payments, messaging,
              and email delivery. We do not sell personal data. Cross-border processing may occur with safeguards
              appropriate for the applicable legal framework.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">6) Security and retention</h2>
            <p className="text-sm text-muted-foreground">
              We use technical and organizational controls (for example, access restrictions, transport security,
              and monitoring). Data is retained only as long as needed for service delivery, compliance,
              dispute handling, and security operations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">7) Your rights and requests</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {rights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              You can submit privacy-related requests through official ACE NAIJA support channels. We may verify
              identity before completing sensitive account actions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">8) Policy updates</h2>
            <p className="text-sm text-muted-foreground">
              We may update this policy as features, laws, or operational requirements evolve.
              Material updates will be reflected on this page with an updated effective date.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">
            Effective date: {new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
