import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  BookOpen,
  CheckCircle2,
  Clock3,
  ClipboardList,
  GraduationCap,
  ScrollText,
  Sparkles,
  Users2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SuccessStoriesSlider } from "@/components/marketing/success-stories-slider";
import { ContactRevealCard } from "@/components/marketing/contact-reveal-card";

const examTracks = [
  {
    exam: "WAEC and NECO",
    icon: GraduationCap,
    detail: "Break each subject into daily targets, practice by objective, and revise weak topics before exam day."
  },
  {
    exam: "JAMB UTME",
    icon: BookOpen,
    detail:
      "Train with timed objective-question sessions, track speed and accuracy, and focus on the topics that impact your score."
  },
  {
    exam: "IELTS",
    icon: ScrollText,
    detail: "Build consistency with daily practice and instant explanations that sharpen understanding and retention."
  },
  {
    exam: "GMAT and ICAN",
    icon: ClipboardList,
    detail: "Practice high-value concepts with structured mock sessions and performance tracking per paper area."
  }
];

const learnerBenefits = [
  "Personalized syllabus plan that adapts to your pace",
  "Daily objective questions plus weak-area drills after every attempt",
  "Performance dashboard with topic-level growth insights",
  "Mock exam mode with timer, scoring, and review",
  "Learning groups for accountability, challenges, and momentum",
  "AI explanations that clarify mistakes instantly"
];

export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-background via-background to-muted/30">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-72 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-[38rem] h-60 w-60 rounded-full bg-amber-200/40 blur-3xl" />
      <SiteHeader />
      <main className="container page-enter pb-20 pt-12">
        <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <Badge variant="secondary" className="mb-5 inline-flex gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
              <Sparkles className="h-4 w-4 text-primary" />
              Structured prep system
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Professional exam preparation for WAEC, NECO, JAMB, IELTS, ICAN, and GMAT.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
              ACE NAIJA turns each syllabus into a guided learning path, delivers topic-specific objective questions,
              and tracks weak areas daily so you improve steadily until exam day.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link href="/signup">
                  Start learning now <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/pricing">See plans</Link>
              </Button>
            </div>
          </div>

          <Card className="relative overflow-hidden border-primary/20 p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative space-y-5">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">What you get</div>
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-semibold">Syllabus to daily plan</div>
                    <p className="text-sm text-muted-foreground">Clear topics, deadlines, and study rhythm.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-semibold">Topic questions + explanations</div>
                    <p className="text-sm text-muted-foreground">Practice immediately after each lesson.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-semibold">Progress visibility</div>
                    <p className="text-sm text-muted-foreground">Identify gaps and measure weekly gains.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mx-auto mt-16 max-w-5xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Exam-focused pathways</h2>
            <Badge variant="outline" className="rounded-full">Syllabus-aligned</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {examTracks.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.exam} className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-primary">{item.exam}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="relative overflow-hidden border-primary/20 p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative">
              <Badge variant="secondary" className="rounded-full">Why learners subscribe</Badge>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
                <Clock3 className="h-4 w-4" />
                Progress you can feel weekly
              </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {learnerBenefits.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-primary/20 bg-card p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative">
              <Badge className="mb-3 rounded-full">Most popular</Badge>
              <h3 className="text-lg font-semibold">Pro membership</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything candidates need for disciplined, high-impact preparation.
              </p>
              <div className="mt-4 text-4xl font-semibold tracking-tight">
                N3,000
                <span className="ml-1 text-base font-medium text-muted-foreground">/month</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Unlimited objective questions and weak-area mode</li>
                <li>Mock exams with timer and review</li>
                <li>Learning groups and challenge mode</li>
                <li>AI explanations and guided tutoring</li>
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild>
                  <Link href="/signup">Start Pro</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/pricing">View full pricing</Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section className="mx-auto mt-16 max-w-5xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Success stories</h2>
            <Badge variant="secondary" className="rounded-full">
              Learner wins
            </Badge>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <SuccessStoriesSlider />
            <ContactRevealCard />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
