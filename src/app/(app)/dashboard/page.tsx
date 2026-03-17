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
import { isPlanItemQuizCompleted } from "@/lib/plans/content";
import { CheckCircle2 } from "lucide-react";
import { getTimedAccessDaysRemaining, getTimedAccessEndsAt, hasActiveProAccess, isFreeTrialActive } from "@/lib/billing/access";
import { describePace } from "@/lib/plans/pace";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { AddExamSubjectFields } from "@/components/settings/add-exam-subject-fields";
import { addExamSubjectAction } from "@/app/(app)/settings/actions";

export default async function DashboardPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const [plan, profileRes, userExamSubjectsRes, exams] = await Promise.all([
    getActivePlanForUser(user.id),
    firebase
      .from("profiles")
      .select("name,display_name,avatar_url,subscription_tier,pro_until")
      .eq("user_id", user.id)
      .maybeSingle(),
    firebase
      .from("user_exam_subjects")
      .select("exam_id,subject,is_active")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    listActiveExams()
  ]);

  const profile = profileRes.data;
  const proAccess = hasActiveProAccess(profile);
  const freeTrialActive = isFreeTrialActive(profile);
  const timedAccessEndsAt = getTimedAccessEndsAt(profile);
  const timedAccessDays = getTimedAccessDaysRemaining(profile);
  const userExamSubjects = userExamSubjectsRes.data ?? [];
  const examOptions = exams.map((exam) => ({
    id: exam.id,
    slug: exam.slug,
    name: exam.name,
    subjects: Array.isArray(exam.subjects) ? (exam.subjects as string[]) : []
  }));
  const existingSelections = userExamSubjects.map((item) => ({ examId: item.exam_id, subject: item.subject }));

  if (!plan) {
    if (!userExamSubjects.length) {
      redirect("/onboarding");
    }

    const displayName = String(profile?.display_name ?? profile?.name ?? user.email ?? "Learner");

    return (
      <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {displayName}. Choose your first exam and subjects to create your study plan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/careers">Browse careers</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">Open settings</Link>
            </Button>
          </div>
        </div>

        {freeTrialActive && timedAccessEndsAt ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Your 3-day free access is active</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  You have {timedAccessDays} day{timedAccessDays === 1 ? "" : "s"} left. Start with one exam now, then add more later from Settings.
                </div>
              </div>
              <Button asChild>
                <Link href="/pricing">See upgrade options</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add your exam subjects</CardTitle>
            <CardDescription>
              Pick one exam, tick the subjects you want, and we will build your first study plan immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AuthFormState action={addExamSubjectAction}>
              <input type="hidden" name="redirect_to" value="/dashboard" />
              <AddExamSubjectFields exams={examOptions} existingSelections={existingSelections} />
              <div className="mt-4">
                <SubmitButton type="submit" pendingText="Creating your plan..." className="w-full sm:w-auto">
                  Save exam subjects
                </SubmitButton>
              </div>
            </AuthFormState>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  const { data: recentNotifications } = await firebase
    .from("notifications")
    .select("id,message,status,channel,scheduled_for,sent_at,created_at")
    .eq("user_id", user.id)
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: notificationPrefs } = await firebase
    .from("notification_prefs")
    .select("reminders,reminder_time")
    .eq("user_id", user.id)
    .maybeSingle();

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
  const reminderSchedule = Array.isArray((notificationPrefs as any)?.reminders)
    ? ((notificationPrefs as any).reminders as Array<Record<string, unknown>>)
        .map((reminder) => ({
          time: String(reminder?.time ?? "").trim(),
          channel: String(reminder?.channel ?? "in_app").trim()
        }))
        .filter((reminder) => /^\d{2}:\d{2}$/.test(reminder.time))
        .slice(0, 3)
    : notificationPrefs?.reminder_time
      ? [{ time: String(notificationPrefs.reminder_time), channel: "in_app" }]
      : [];

  const displayName: string = String(profile?.display_name ?? profile?.name ?? user.email ?? "Learner");
  const paceLabel = describePace(plan.pace);
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
            {plan.mode === "group" ? "Group mode" : "Solo mode"} | {paceLabel} |{" "}
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

      {freeTrialActive && timedAccessEndsAt ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Your 3-day free access is active</div>
              <div className="mt-1 text-sm text-muted-foreground">
                You have {timedAccessDays} day{timedAccessDays === 1 ? "" : "s"} left before the free plan drops back to
                one exam and one subject.
              </div>
            </div>
            <Button asChild>
              <Link href="/billing">Keep Pro active</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
                    <Link href={proAccess ? "/quiz/extra" : "/pricing"}>{proAccess ? "Practice weak areas" : "Upgrade to keep practicing"}</Link>
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
                          <Link
                            href={
                              proAccess
                                ? `/quiz/extra?exam_id=${examId}&subject=${encodeURIComponent(subject)}`
                                : "/pricing"
                            }
                          >
                            {proAccess ? "Practice" : "Upgrade for practice"}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminders & alerts</CardTitle>
          <CardDescription>Study reminders appear here in-app, alongside your configured reminder windows.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="text-sm font-semibold">Reminder schedule</div>
            {reminderSchedule.length ? (
              reminderSchedule.map((reminder) => (
                <div key={`${reminder.channel}-${reminder.time}`} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{reminder.channel.replace("_", " ")}</span>
                  <Badge variant="secondary">{reminder.time}</Badge>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Set reminder times in Settings to start receiving in-app study nudges.</div>
            )}
            <div className="grid gap-2">
              <Button asChild variant="secondary" className="w-full">
                <Link href="/settings">Manage reminders</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/notifications">Open notifications</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {recentNotifications?.length ? (
              recentNotifications.map((notification) => (
                <div key={notification.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{notification.message}</div>
                    <Badge variant={notification.status === "sent" ? "secondary" : "outline"}>{notification.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {notification.sent_at
                      ? `Sent ${new Date(notification.sent_at).toLocaleString()}`
                      : `Scheduled ${new Date(notification.scheduled_for ?? notification.created_at).toLocaleString()}`}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
                No in-app reminders yet. Once your reminder schedule runs, the latest study nudges will show up here.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
