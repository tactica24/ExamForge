import Link from "next/link";
import { BarChart3, BrainCircuit, Building2, CheckCircle2, MessageCircleMore, Trophy, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SUPPORT_WHATSAPP_URL } from "@/lib/contact/requests";

const proBenefits = [
  "Multiple exam and subject combinations",
  "Unlimited objective questions across subjects",
  "Weak-area practice mode",
  "Full mock exams with timer and review",
  "Learning groups, leaderboard, and challenges",
  "AI explanations and tutor support",
  "Progress analytics by subject and topic",
  "Smart reminders and streak tracking"
];

const enterpriseBenefits = [
  "Custom onboarding for schools and cohorts",
  "Dedicated admin support and priority issue resolution",
  "Custom reporting, compliance, and rollout support",
  "Integration planning for WhatsApp/SMS workflows"
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/20">
      <SiteHeader />
      <main className="container page-enter pb-16 pt-12">
        <div className="mx-auto max-w-6xl">
          <Badge variant="secondary" className="mb-4 rounded-full text-xs uppercase tracking-[0.2em]">
            Pricing
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose the plan that fits your prep style</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every new account starts with 3 days of full access. Upgrade to Pro when you want to keep the wider
            subject range, premium practice, and stronger accountability tools active.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <Card className="p-6">
              <div className="text-sm font-medium">Free</div>
              <div className="mt-2 text-3xl font-semibold">N0</div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>First 3 days include full access across study, practice, mock exams, and groups</li>
                <li>After the free-access window: one exam + one subject stays active</li>
                <li>Objective questions, history, and review remain available on the free plan</li>
                <li>Upgrade prompt appears when you try to add more subjects or premium tools</li>
              </ul>
              <div className="mt-6">
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/signup">Create account</Link>
                </Button>
              </div>
            </Card>

            <Card className="relative overflow-hidden border-primary/20 p-6">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative">
                <Badge className="rounded-full">Best value</Badge>
                <div className="mt-3 text-sm font-medium">Pro</div>
                <div className="mt-2 text-4xl font-semibold tracking-tight">
                  N3,000
                  <span className="ml-1 text-base font-medium text-muted-foreground">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Designed for learners who want measurable score improvement.</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {proBenefits.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex gap-2">
                  <Button asChild className="w-full">
                    <Link href="/billing">Upgrade to Pro</Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full">
                    <Link href="/dashboard">Open dashboard</Link>
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-cyan-500/10 p-6">
              <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/20 blur-2xl" />
              <div className="relative">
                <Badge variant="outline" className="rounded-full border-emerald-500/40 text-emerald-700">
                  Enterprise
                </Badge>
                <div className="mt-3 text-sm font-medium">Enterprise</div>
                <div className="mt-2 text-4xl font-semibold tracking-tight">Custom</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Contact us for custom deployment, integrations, and institutional rollout.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {enterpriseBenefits.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 grid gap-2">
                  <Button asChild variant="outline" className="w-full border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10">
                    <Link href="/contact?intent=enterprise">
                      <MessageCircleMore className="mr-2 h-4 w-4" /> Contact us
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full">
                    <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer">
                      <MessageCircleMore className="mr-2 h-4 w-4" /> WhatsApp us
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <BrainCircuit className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-medium">Adaptive learning</div>
              <p className="mt-1 text-sm text-muted-foreground">Objective questions adapt around mistakes so practice time stays efficient.</p>
            </Card>
            <Card className="p-5">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-medium">Performance visibility</div>
              <p className="mt-1 text-sm text-muted-foreground">See subject-level trends and identify weak topics early.</p>
            </Card>
            <Card className="p-5">
              <Users2 className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-medium">Accountability layer</div>
              <p className="mt-1 text-sm text-muted-foreground">Group study, leaderboard, and streak systems keep you consistent.</p>
            </Card>
          </div>

          <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />
            ACE NAIJA is an independent preparation platform and is not affiliated with any exam body.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
