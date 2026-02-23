import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { StudyAudioPlayer } from "@/components/plan/study-audio-player";
import { StudySlidesPlayer } from "@/components/plan/study-slides-player";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import {
  getPlanItemLesson,
  getPlanItemLessonAssets,
  getPlanItemProgress,
  isPlanItemQuizCompleted,
  type PlanStudyFormat
} from "@/lib/plans/content";
import {
  createPlanTopicQuizAction,
  generatePlanTopicStudyFormatAction,
  updatePlanItemStatusAction
} from "@/app/(app)/plan/actions";

function normalizeRequestedFormat(value: unknown): PlanStudyFormat | null {
  const format = String(value ?? "").trim().toLowerCase();
  if (format === "audio") return "audio";
  if (format === "slides" || format === "video" || format === "ppt") return "slides";
  if (format === "text") return "text";
  return null;
}

function safeFileName(value: string) {
  return String(value || "slides")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default async function PlanTopicPage(props: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const [{ itemId }, sp] = await Promise.all([props.params, props.searchParams]);
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

  const { data: orderedItems } = await firebase
    .from("plan_items")
    .select("id,scheduled_for,day_index,status,resource_links,created_at")
    .eq("plan_id", plan.id)
    .order("scheduled_for", { ascending: true })
    .order("day_index", { ascending: true })
    .order("created_at", { ascending: true });

  const ordered = orderedItems ?? [];
  const idx = ordered.findIndex((row: any) => String(row?.id ?? "") === item.id);
  const firstIncomplete = ordered.slice(0, Math.max(idx, 0)).find((row: any) => {
    const completed = isPlanItemQuizCompleted(row?.resource_links) || row?.status === "done";
    return !completed;
  });
  const locked = Boolean(firstIncomplete);

  const [{ data: exam }, { data: profile }] = await Promise.all([
    firebase.from("exams").select("name").eq("id", plan.exam_id).maybeSingle(),
    firebase.from("profiles").select("preferred_explanation_language").eq("user_id", user.id).maybeSingle()
  ]);

  const progress = getPlanItemProgress(item.resource_links);
  const lesson = getPlanItemLesson(item.resource_links);
  const assets = getPlanItemLessonAssets(item.resource_links);
  const selectedFormat = normalizeRequestedFormat(sp.format) ?? assets.selected_format ?? (lesson ? "text" : null);
  const audioNarration = assets.audio?.narration ?? "";
  const slideDeck = assets.slides;
  const preferredLanguage = profile?.preferred_explanation_language ?? "en";

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
            {locked ? (
              <Badge variant="outline">Locked</Badge>
            ) : lesson ? (
              <Badge variant={lesson.source === "ai" ? "secondary" : "outline"}>
                {lesson.source === "ai" ? "AI lesson" : "Starter lesson"}
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            {exam?.name ?? "Exam"} | {plan.subject} | {item.scheduled_for}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locked ? (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
              Complete the previous topic and quiz to unlock this study guide.
              {firstIncomplete ? (
                <div className="mt-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/plan/${String((firstIncomplete as any)?.id ?? "")}`}>Go to previous topic</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : lesson ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{lesson.overview}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Choose a study format below to generate this topic guide.
            </p>
          )}
        </CardContent>
      </Card>

      {!locked ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Study format</CardTitle>
            <CardDescription>Generate once and reuse across learners with the same exam topic and language.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={selectedFormat === "text" ? "default" : "outline"}>Text</Badge>
              <Badge variant={selectedFormat === "audio" ? "default" : "outline"}>
                Audio {assets.audio ? "ready" : "pending"}
              </Badge>
              <Badge variant={selectedFormat === "slides" ? "default" : "outline"}>
                Video/PPT {assets.slides ? "ready" : "pending"}
              </Badge>
            </div>
            <AuthFormState action={generatePlanTopicStudyFormatAction}>
              <input type="hidden" name="item_id" value={item.id} />
              <div className="flex flex-wrap gap-2">
                <SubmitButton type="submit" name="format" value="text" pendingText="Generating..." size="sm">
                  {lesson ? "Open text" : "Generate text"}
                </SubmitButton>
                <SubmitButton type="submit" name="format" value="audio" pendingText="Generating..." size="sm" variant="outline">
                  {assets.audio ? "Open audio" : "Generate audio"}
                </SubmitButton>
                <SubmitButton type="submit" name="format" value="video" pendingText="Generating..." size="sm" variant="outline">
                  {assets.slides ? "Open video/PPT" : "Generate video/PPT"}
                </SubmitButton>
              </div>
            </AuthFormState>
          </CardContent>
        </Card>
      ) : null}

      {!locked && selectedFormat === "audio" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audio lesson</CardTitle>
            <CardDescription>Play narration in-app. Text remains available for low-data reading.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {audioNarration ? (
              <>
                <StudyAudioPlayer text={audioNarration} language={preferredLanguage} />
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                  {audioNarration}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Generate audio to unlock narration for this topic.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!locked && selectedFormat === "slides" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Video/PPT slides</CardTitle>
            <CardDescription>5-10 slide script with autoplay and deck download for reuse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {slideDeck ? (
              <StudySlidesPlayer deck={slideDeck} fileName={`${safeFileName(`${plan.subject}-${item.title}`)}-slides.json`} />
            ) : (
              <p className="text-sm text-muted-foreground">Generate video/PPT to unlock your slide deck.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!locked && lesson && (selectedFormat === "text" || selectedFormat === null) ? (
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
      ) : null}

      {!locked && lesson && (selectedFormat === "text" || selectedFormat === null) ? (
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
      ) : null}

      {!locked && lesson && (selectedFormat === "text" || selectedFormat === null) ? (
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
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next action</CardTitle>
          <CardDescription>After reading, launch the quiz for this exact topic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!locked ? (
            <>
              <AuthFormState action={createPlanTopicQuizAction}>
                <input type="hidden" name="item_id" value={item.id} />
                <SubmitButton type="submit" pendingText="Preparing quiz..." className="w-full sm:w-auto">
                  {progress.quiz.completed ? "Retry topic quiz" : "Take topic quiz"}
                </SubmitButton>
              </AuthFormState>
              {progress.quiz.completed ? (
                <p className="text-xs text-muted-foreground">
                  Completed {progress.quiz.attempts} time{progress.quiz.attempts === 1 ? "" : "s"} - Last quiz{" "}
                  {progress.quiz.completed_at ? new Date(progress.quiz.completed_at).toLocaleDateString() : "completed"}
                </p>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Finish the previous topic quiz to unlock this one.</div>
          )}

          <AuthFormState action={updatePlanItemStatusAction}>
            <input type="hidden" name="item_id" value={item.id} />
            <div className="grid grid-cols-3 gap-2 sm:max-w-md">
              <Button type="submit" name="status" value="done" variant="secondary" size="sm" disabled={locked}>
                Done
              </Button>
              <Button type="submit" name="status" value="skipped" variant="outline" size="sm" disabled={locked}>
                Skip
              </Button>
              <Button type="submit" name="status" value="todo" variant="ghost" size="sm" disabled={locked}>
                Reset
              </Button>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>
    </div>
  );
}

