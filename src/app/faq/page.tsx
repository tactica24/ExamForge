import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const faqItems = [
  {
    question: "How does ACE NAIJA work?",
    answer:
      "You sign up, choose your exam and subjects, and the platform builds a study path from the syllabus. From there you practice objective questions, review mistakes, track progress, and stay accountable with reminders and groups."
  },
  {
    question: "Do new users really get a free trial?",
    answer:
      "Yes. Every new user gets 7 days of full access after signup. When that window ends, new premium actions like extra quiz generation and fresh study-plan generation require an upgrade."
  },
  {
    question: "What happens after the free trial ends?",
    answer:
      "Your history, past results, mock reviews, and other existing records remain visible. The app simply blocks new premium generation actions until you upgrade."
  },
  {
    question: "How do payments work?",
    answer:
      "Pro access is billed for a 30-day period from the day you activate it, not from the 1st to the 30th of a calendar month."
  },
  {
    question: "What is the refund policy?",
    answer:
      "Refund requests are reviewed case by case, especially where there is a verified billing issue or a platform-side failure. The fastest path is to contact support with your payment details and what went wrong."
  },
  {
    question: "Can schools or large cohorts use the platform?",
    answer:
      "Yes. Use the enterprise contact option to tell us about your rollout needs, reporting expectations, or support workflow."
  }
];

export default function FaqPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/20">
      <SiteHeader />
      <main className="container page-enter pb-16 pt-12">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="rounded-full">FAQ</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Answers to the questions learners ask most.</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              This page covers the basics around how the platform works, payments, the free trial, and how to get help when something needs attention.
            </p>
          </div>

          <div className="grid gap-4">
            {faqItems.map((item) => (
              <Card key={item.question} className="p-6">
                <div className="text-lg font-semibold">{item.question}</div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
