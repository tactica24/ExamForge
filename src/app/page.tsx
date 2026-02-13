import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/20">
      <SiteHeader />
      <main className="container pb-16 pt-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Built for Nigeria-first, global-ready exam prep
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Exam prep that feels like a{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              complete brain box
            </span>
            .
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
            ExamForge turns syllabi into daily plans, generates endless quizzes, tracks progress, and
            keeps you consistent with reminders—solo or in matched groups.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link href="/signup">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <div className="text-sm font-medium">Syllabus → Plan</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Pick WAEC/JAMB/IELTS/ACCA/ICAN, choose subjects, and get a personalized pace.
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-sm font-medium">Endless Quizzes</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Daily, extra weak-area, and group challenges with instant explanations.
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-sm font-medium">Consistency Engine</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Streaks, progress charts, and notifications that nudge you at the right time.
              </div>
            </Card>
          </div>

          <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
              <div>
                <div className="text-sm font-medium">What you get out of the box</div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {[
                    "Email or phone login via Supabase Auth",
                    "Exam/subject selection with seeded Nigerian exams",
                    "AI-assisted quiz generation (with safe fallbacks)",
                    "Solo + group mode with matching and real-time chat",
                    "Subscription-ready billing scaffolding (Paystack-first)"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-primary/10 via-muted/40 to-transparent p-5">
                <div className="text-sm font-medium">Ready in minutes</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Add your Supabase project keys and optional OpenAI/Paystack keys, then deploy to
                  Vercel.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/dashboard">Open dashboard</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

