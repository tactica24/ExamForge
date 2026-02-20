import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { generatePlanLesson } from "@/lib/plans/lesson";
import { getPlanItemLesson, getPlanItemResourceLinks, withPlanItemLesson } from "@/lib/plans/content";
import { createPlanTopicQuizAction, updatePlanItemStatusAction } from "@/app/(app)/plan/actions";
import type { Json } from "@/lib/firebase/database.types";

function normalizeTopicKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function findTopicSubtopics(topics: unknown, topicPath: string, title: string): string[] {
  if (!Array.isArray(topics)) return [];
  const targetPath = normalizeTopicKey(topicPath);
  const targetTitle = normalizeTopicKey(title);

  const match = topics.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    const pathKey = normalizeTopicKey(row.path);
    const titleKey = normalizeTopicKey(row.title);
    return pathKey === targetPath || titleKey === targetPath || pathKey === targetTitle || titleKey === targetTitle;
  });

  if (!match || typeof match !== "object") return [];
  const subtopics = (match as Record<string, unknown>).subtopics;
  if (!Array.isArray(subtopics)) return [];

  return subtopics
    .map((entry) =>
      String(entry ?? "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 8);
}

export default async function PlanTopicPage(props: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await props.params;
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: item } = await firebase
    .from("plan_items")
    .select("id,plan_id,scheduled_for,title,topic_path,status,resource_links")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) redirect("/plan");

  const { data: plan } = await firebase
    .from("user_plans")
    .select("id,user_id,exam_id,subject")
    .eq("id", item.plan_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!plan) redirect("/plan");

  const [{ data: exam }, { data: profile }, { data: syllabus }] = await Promise.all([
    firebase.from("exams").select("name").eq("id", plan.exam_id).maybeSingle(),
    firebase.from("profiles").select("preferred_explanation_language").eq("user_id", user.id).maybeSingle(),
    firebase.from("syllabi").select("topics").eq("exam_id", plan.exam_id).eq("subject", plan.subject).maybeSingle()
  ]);

  const resources = getPlanItemResourceLinks(item.resource_links);
  let lesson = getPlanItemLesson(item.resource_links);

  if (!lesson) {
    lesson = await generatePlanLesson({
      examName: exam?.name ?? "Exam",
      subject: plan.subject,
      topicPath: item.topic_path,
      topicTitle: item.title,
      subtopics: findTopicSubtopics(syllabus?.topics, item.topic_path, item.title),
      preferredLanguage: profile?.preferred_explanation_language ?? "en"
    });

    const nextResourceLinks = withPlanItemLesson(item.resource_links, lesson);
    await firebase.from("plan_items").update({ resource_links: nextResourceLinks as Json }).eq("id", item.id);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/plan">Back to plan</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{item.title}</CardTitle>
            <Badge variant={item.status === "done" ? "default" : item.status === "skipped" ? "secondary" : "outline"}>
              {item.status}
            </Badge>
            <Badge variant={lesson.source === "ai" ? "secondary" : "outline"}>
              {lesson.source === "ai" ? "AI lesson" : "Starter lesson"}
            </Badge>
          </div>
          <CardDescription>
            {exam?.name ?? "Exam"} | {plan.subject} | {item.scheduled_for}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{lesson.overview}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic breakdown</CardTitle>
          <CardDescription>Read this first, then take the topic quiz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lesson.breakdown.map((section) => (
            <div key={section.heading} className="rounded-xl border border-border/60 p-4">
              <h3 className="text-sm font-semibold">{section.heading}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.explanation}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Worked examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lesson.examples.map((example, index) => (
            <div key={`${example.question}-${index}`} className="rounded-xl border border-border/60 p-4">
              <p className="text-sm font-semibold">{example.question}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{example.walkthrough}</p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Answer focus:</span> {example.answer}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mistakes to avoid</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Common mistakes</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {lesson.common_mistakes.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Quick recap</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {lesson.recap.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {resources.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extra resources</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {resources.map((resource) => (
              <a
                key={`${resource.title}-${resource.url}`}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-primary transition hover:bg-muted"
              >
                {resource.title}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next action</CardTitle>
          <CardDescription>After reading, launch the quiz for this exact topic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthFormState action={createPlanTopicQuizAction}>
            <input type="hidden" name="item_id" value={item.id} />
            <SubmitButton type="submit" pendingText="Preparing quiz..." className="w-full sm:w-auto">
              Take topic quiz
            </SubmitButton>
          </AuthFormState>

          <AuthFormState action={updatePlanItemStatusAction}>
            <input type="hidden" name="item_id" value={item.id} />
            <div className="grid grid-cols-3 gap-2 sm:max-w-md">
              <Button type="submit" name="status" value="done" variant="secondary" size="sm">
                Done
              </Button>
              <Button type="submit" name="status" value="skipped" variant="outline" size="sm">
                Skip
              </Button>
              <Button type="submit" name="status" value="todo" variant="ghost" size="sm">
                Reset
              </Button>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>
    </div>
  );
}
