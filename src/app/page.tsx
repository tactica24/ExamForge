import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Sparkles,
  Users2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const examTracks = [
  {
    exam: "WAEC and NECO",
    detail: "Break each subject into daily targets, practice by objective, and revise weak topics before exam day."
  },
  {
    exam: "JAMB UTME",
    detail: "Train with timed quiz sessions, track speed and accuracy, and focus on the topics that impact your score."
  },
  {
    exam: "IELTS",
    detail: "Build consistency with daily practice and instant explanations that sharpen understanding and retention."
  },
  {
    exam: "ACCA and ICAN",
    detail: "Practice high-value concepts with structured mock sessions and performance tracking per paper area."
  }
];

const learnerBenefits = [
  "Personalized syllabus plan that adapts to your pace",
  "Daily quizzes plus weak-area drills after every attempt",
  "Performance dashboard with topic-level growth insights",
  "Mock exam mode with timer, scoring, and review",
  "Learning groups for accountability, challenges, and momentum",
  "AI explanations that clarify mistakes instantly"
];

export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-background via-background to-muted/30">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-72 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <SiteHeader />
      <main className="container pb-20 pt-12">
        <section className="mx-auto max-w-5xl">
          <Badge variant="secondary" className="mb-5 inline-flex gap-2 rounded-full px-3 py-1 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Smarter prep. Stronger scores.
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Turn every study session into measurable exam progress.
          </h1>
          <p className="mt-5 max-w-3xl text-pretty text-lg text-muted-foreground">
            ExamForge creates a personalized plan from your exam syllabus, delivers focused quizzes daily,
            and shows exactly where to improve so you can walk into exam day prepared and confident.
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

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <GraduationCap className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-medium">Syllabus to Study Plan</div>
              <p className="mt-1 text-sm text-muted-foreground">Daily tasks generated from your chosen exam and subjects.</p>
            </Card>
            <Card className="p-5">
              <BrainCircuit className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-medium">Adaptive Quiz Engine</div>
              <p className="mt-1 text-sm text-muted-foreground">Topic-focused practice with weak-area reinforcement after each attempt.</p>
            </Card>
            <Card className="p-5">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-medium">Performance Monitoring</div>
              <p className="mt-1 text-sm text-muted-foreground">Track growth by subject, topic, streak, and consistency trend.</p>
            </Card>
            <Card className="p-5">
              <Users2 className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-medium">Learning Groups</div>
              <p className="mt-1 text-sm text-muted-foreground">Join focused groups, compete with peers, and stay accountable.</p>
            </Card>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-5xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Exam-focused pathways</h2>
            <Badge variant="outline" className="rounded-full">Syllabus-aligned</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {examTracks.map((item) => (
              <Card key={item.exam} className="p-5">
                <div className="text-sm font-semibold text-primary">{item.exam}</div>
                <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Clock3 className="h-4 w-4" />
              Why serious learners subscribe
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {learnerBenefits.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="relative overflow-hidden border-primary/20 bg-card p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative">
              <Badge className="mb-3 rounded-full">Most popular</Badge>
              <h3 className="text-lg font-semibold">Pro membership</h3>
              <p className="mt-1 text-sm text-muted-foreground">Everything you need to prepare faster and score higher.</p>
              <div className="mt-4 text-4xl font-semibold tracking-tight">
                N7,500
                <span className="ml-1 text-base font-medium text-muted-foreground">/month</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Unlimited quizzes and weak-area mode</li>
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
      </main>
      <SiteFooter />
    </div>
  );
}
