import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const prohibitedUses = [
  "Using the platform for exam malpractice, cheating services, or impersonation",
  "Uploading unlawful, abusive, infringing, or harmful material",
  "Attempting unauthorized access, scraping, reverse engineering, or service disruption",
  "Harassing users in groups, messages, or any collaboration channels",
  "Sharing content in ways that violate intellectual property rights"
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/20">
      <SiteHeader />
      <main className="container page-enter pb-16 pt-12">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h1 className="text-3xl font-semibold tracking-tight">Terms of Use</h1>
            <p className="text-sm text-muted-foreground">
              ACE NAIJA is a preparation platform for study planning, practice, and performance monitoring.
              It is not an official exam authority and is not affiliated with any examination body.
            </p>
          </div>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">1) Educational purpose and no score guarantee</h2>
            <p className="text-sm text-muted-foreground">
              ACE NAIJA provides practice content, mock simulations, and analytics to support preparation.
              Performance in practice or mock exams does not guarantee outcomes in any official exam.
              For example, a high mock score (including 400/400) does not guarantee the same result in a live exam,
              which may differ in difficulty, conditions, marking, and candidate factors.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">2) Account responsibilities</h2>
            <p className="text-sm text-muted-foreground">
              You are responsible for maintaining account confidentiality, ensuring your profile information is accurate,
              and all activity under your account. You must use the service in compliance with applicable law and platform rules.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">3) Acceptable use</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {prohibitedUses.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              We may moderate content and enforce restrictions, including suspension or termination, to protect learners and the platform.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">4) Content and intellectual property</h2>
            <p className="text-sm text-muted-foreground">
              ACE NAIJA retains rights in the platform, features, brand assets, and original materials.
              Third-party marks and exam names belong to their respective owners and are referenced only for preparation context.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">5) Subscriptions, billing, and changes</h2>
            <p className="text-sm text-muted-foreground">
              Paid features require an active subscription and successful payment processing.
              Pricing, plan features, and payment providers may change over time; material pricing or plan changes are communicated in-product or on official pages.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">6) Availability and service updates</h2>
            <p className="text-sm text-muted-foreground">
              We continuously improve ACE NAIJA and may modify, add, pause, or discontinue features.
              We do not guarantee uninterrupted availability, error-free operation, or compatibility with every device and network condition.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">7) Limitation of liability</h2>
            <p className="text-sm text-muted-foreground">
              To the fullest extent permitted by law, ACE NAIJA and its operators are not liable for indirect, incidental,
              special, consequential, or educational-outcome-related losses arising from use of the service,
              including exam results, missed opportunities, or reliance on practice analytics.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">8) Suspension and termination</h2>
            <p className="text-sm text-muted-foreground">
              We may suspend or terminate access for violations of these terms, abuse, security risk, legal requirements,
              or fraudulent activity. You may stop using the service at any time and request account deletion through support channels.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-6">
            <h2 className="text-lg font-semibold tracking-tight">9) Updates to these terms</h2>
            <p className="text-sm text-muted-foreground">
              We may revise these terms as the product, legal environment, and operational requirements evolve.
              Continued use after updates means you accept the revised terms.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">Effective date: {new Date().toISOString().slice(0, 10)}</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
