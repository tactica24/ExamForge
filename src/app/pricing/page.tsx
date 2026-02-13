import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/20">
      <SiteHeader />
      <main className="container pb-16 pt-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pricing</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Start free, upgrade when you need unlimited quizzes, groups, reminders, and the AI
            tutor.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card className="p-6">
              <div className="text-sm font-medium">Free</div>
              <div className="mt-2 text-3xl font-semibold">₦0</div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Limited daily quizzes</li>
                <li>One active group</li>
                <li>In-app reminders only</li>
              </ul>
              <div className="mt-6">
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/signup">Create account</Link>
                </Button>
              </div>
            </Card>

            <Card className="relative overflow-hidden p-6">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative">
                <div className="text-sm font-medium">Pro</div>
                <div className="mt-2 text-3xl font-semibold">₦2,000–₦5,000/mo</div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>Unlimited quizzes + weak-area mode</li>
                  <li>Unlimited groups + challenges</li>
                  <li>WhatsApp/SMS/email reminders (optional)</li>
                  <li>AI tutor chat + advanced plan adjustments</li>
                </ul>
                <div className="mt-6 flex gap-2">
                  <Button asChild className="w-full">
                    <Link href="/billing">Upgrade</Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            Disclaimer: ExamForge is not affiliated with WAEC, JAMB, IELTS, ACCA, or ICAN. Content is
            for preparation only.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

