import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { cn } from "@/lib/utils";
import { listActiveExams } from "@/lib/exams/list";
import { getPlanItemResourceLinks, isPlanItemQuizCompleted } from "@/lib/plans/content";
import { CheckCircle2 } from "lucide-react";
import { hasActiveProAccess } from "@/lib/billing/access";

export default async function DashboardPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const { data: profile } = await firebase
    .from("profiles")
    .select("name,display_name,avatar_url,subscription_tier,pro_until")
    .eq("user_id", user.id)
    .maybeSingle();
  const proAccess = hasActiveProAccess(profile);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const { data: gamificationData, error: gamificationErr } = await firebase
    .from("user_gamification")
    .select("streak_count,total_xp,level,badges")
    .eq("user_id", user.id)
    .maybeSingle();
  const gamification = gamificationErr ? null : gamificationData;

  const streak = gamification?.streak_count ?? 0;
  const totalXp = gamification?.total_xp ?? 0;
  const level = gamification?.level ?? 1;
  const nextLevelAt = level * 100;
  const levelProgress = Math.min(100, Math.round((totalXp / Math.max(1, nextLevelAt)) * 100));
  const badgesCount = Array.isArray(gamification?.badges) ? (gamification?.badges as any[]).length : 0;

  const { data: todayItems } = await firebase
    .from("plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .eq("scheduled_for", todayStr)
    .order("day_index", { ascending: true });

  const { data: recentResults } = await firebase
    .from("user_quiz_results")
    .select("score,total,created_at,quiz_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: userExamSubjects } = await firebase
    .from("user_exam_subjects")
    .select("exam_id,subject,is_active")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const exams = await listActiveExams();
  const examNameById = new Map(exams.map((exam) => [exam.id, exam.name]));
  const subjectsByExam = (userExamSubjects ?? []).reduce((acc: Record<string, string[]>, item: any) => {
    if (!item?.exam_id || !item?.subject) return acc;
    acc[item.exam_id] = acc[item.exam_id] ?? [];
    if (!acc[item.exam_id].includes(item.subject)) acc[item.exam_id].push(item.subject);
    return acc;
  }, {});

  const completion = todayItems?.length
    ? Math.round(
        (todayItems.filter((item) => item.status === "done").length / Math.max(1, todayItems.length)) * 100
      )
    : 0;
  const primaryTodayItem = todayItems?.[0] ?? null;

  const avgPercent = recentResults?.length
    ? Math.round(
        recentResults.reduce((acc, result) => acc + (result.total ? (result.score / result.total) * 100 : 0), 0) /
          recentResults.length
      )
    : 0;

  const weakEntries =
    plan?.weak_areas && typeof plan.weak_areas === "object" && !Array.isArray(plan.weak_areas)
      ? Object.entries(plan.weak_areas as any)
          .map(([topic, value]) => ({ topic, score: Number((value as any)?.score ?? value ?? 0) }))
          .filter((entry) => Number.isFinite(entry.score))
          .sort((a, b) => a.score - b.score)
          .slice(0, 3)
      : [];

  const displayName: string = String(profile?.display_name ?? profile?.name ?? user.email ?? "Learner");
  const avatarFallback =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((piece: string) => piece[0]?.toUpperCase())
      .join("") || "U";

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {plan.mode === "group" ? "Group mode" : "Solo mode"} | {plan.pace} pace |{" "}
            <span className="font-medium text-foreground">{todayStr}</span>
            {plan.target_date ? ` | Exam date ${plan.target_date}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/plan">Open plan</Link>
          </Button>
          <Button asChild>
            <Link href={primaryTodayItem ? `/plan/${primaryTodayItem.id}` : "/plan"}>Study today&apos;s topic</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={`${displayName} avatar`} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm text-muted-foreground">Welcome back</div>
              <div className="text-lg font-semibold">{displayName}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Keep your streak alive with one focused session today.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Streak: {streak} day{streak === 1 ? "" : "s"}</Badge>
            <Badge variant="secondary">XP: {totalXp}</Badge>
            <Badge variant="secondary">Level: {level}</Badge>
            <Badge variant="secondary">Badges: {badgesCount}</Badge>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full bg-primary")} style={{ width: `${levelProgress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Level progress: {levelProgress}%</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>Your tasks and quick review loop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Completion</div>
              <Badge variant={completion >= 70 ? "default" : "secondary"}>{completion}%</Badge>
            </div>
            <Separator />
            {todayItems?.length ? (
              <div className="space-y-3">
                {todayItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Link href={`/plan/${item.id}`} className="hover:underline">
                          {item.title}
                        </Link>
                        {isPlanItemQuizCompleted(item.resource_links) || item.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.topic_path}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {getPlanItemResourceLinks(item.resource_links)
                          .slice(0, 2)
                          .map((resource) => (
                            <a
                              key={resource.url}
                              className="text-xs text-primary underline underline-offset-4"
                              href={resource.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {resource.title}
                            </a>
                          ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.status === "done" ? "Done" : item.status === "skipped" ? "Skipped" : "Todo"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No items scheduled for today. Open your plan and keep the streak.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent objective questions</CardTitle>
            <CardDescription>Fast feedback loop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentResults?.length ? (
              recentResults.map((result) => (
                <div key={result.quiz_id} className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {result.score}/{result.total}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(result.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No objective question results yet.</div>
            )}
            <Separator />
            <div className="text-sm">
              <div className="text-muted-foreground">Predicted performance</div>
              <div className="mt-1 font-medium">{avgPercent}%</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Rough estimate from your last {recentResults?.length ?? 0} objective-question sessions.
              </div>
            </div>
            {weakEntries.length ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium">Weak areas</div>
                  {weakEntries.map((entry) => (
                    <div key={entry.topic} className="flex items-center justify-between text-sm">
                      <div className="text-muted-foreground">{entry.topic}</div>
                      <div className="font-medium">{Math.round(entry.score)}%</div>
                    </div>
                  ))}
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/quiz/extra">Practice weak areas</Link>
                  </Button>
                </div>
              </>
            ) : null}
            <Separator />
            <Button asChild variant="secondary" className="w-full">
              <Link href="/progress">View progress</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your exams & subjects</CardTitle>
          <CardDescription>Pick an exam, then practice a subject or launch a mock exam.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(subjectsByExam).length ? (
            Object.entries(subjectsByExam).map(([examId, subjects]) => (
              <div key={examId} className="rounded-xl border bg-card p-4">
                <div className="text-sm font-semibold">{examNameById.get(examId) ?? "Exam"}</div>
                <div className="mt-3 grid gap-2">
                  {subjects.map((subject) => (
                    <div key={subject} className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary">{subject}</Badge>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/quiz/extra?exam_id=${examId}&subject=${encodeURIComponent(subject)}`}>
                            Practice
                          </Link>
                        </Button>
                        <Button asChild size="sm">
                          <Link
                            href={
                              proAccess
                                ? `/mock-exam?exam_id=${examId}&subject=${encodeURIComponent(subject)}`
                                : "/pricing"
                            }
                          >
                            {proAccess ? "Mock exam" : "Upgrade for mock"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">
              Add subjects in settings to see your personalized practice shortcuts.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
