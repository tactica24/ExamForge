import Link from "next/link";
import { BarChart3, BrainCircuit, CheckCircle2, Trophy, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const proBenefits = [
  "Unlimited quizzes across subjects",
  "Weak-area practice mode",
  "Full mock exams with timer and review",
  "Learning groups, leaderboard, and challenges",
  "AI explanations and tutor support",
  "Progress analytics by subject and topic",
  "Smart reminders and streak tracking"
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/20">
      <SiteHeader />
      <main className="container pb-16 pt-12">
        <div className="mx-auto max-w-5xl">
          <Badge variant="secondary" className="mb-4 rounded-full">
            Flexible plans
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing for focused exam prep</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start free, upgrade to Pro when you want full practice volume, better analytics, and stronger accountability.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card className="p-6">
              <div className="text-sm font-medium">Free</div>
              <div className="mt-2 text-3xl font-semibold">N0</div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Limited daily quizzes</li>
                <li>Basic progress view</li>
                <li>One active group</li>
                <li>In-app reminders</li>
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
                  N7,500
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
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <BrainCircuit className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-medium">Adaptive learning</div>
              <p className="mt-1 text-sm text-muted-foreground">Quizzes adapt around mistakes so practice time stays efficient.</p>
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
            ExamForge is an independent preparation platform and is not affiliated with any exam body.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
