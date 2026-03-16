import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const pillars = [
  {
    title: "Why ACE NAIJA exists",
    detail:
      "Many learners do not fail because they are not serious. They struggle because the syllabus is large, revision is inconsistent, and feedback comes too late. ACE NAIJA was built to close that gap."
  },
  {
    title: "What the platform does",
    detail:
      "We turn exam syllabi into guided daily study plans, deliver targeted practice, keep weak areas visible, and add accountability through reminders, mock exams, and subject groups."
  },
  {
    title: "Who it is for",
    detail:
      "Students preparing for WAEC, NECO, JAMB, IELTS, GMAT, ICAN, and other structured exams who want a disciplined, measurable path to improvement."
  }
];

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/20">
      <SiteHeader />
      <main className="container page-enter pb-16 pt-12">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="rounded-full">About us</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">ACE NAIJA was built to make disciplined exam prep feel possible again.</h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              The aim is simple: help learners study with structure, understand what they are getting wrong, and keep moving with confidence until exam day. The platform blends study planning, practice, progress tracking, reminders, and accountability so preparation is not left to guesswork.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {pillars.map((pillar) => (
              <Card key={pillar.title} className="p-6">
                <div className="text-lg font-semibold">{pillar.title}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{pillar.detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
