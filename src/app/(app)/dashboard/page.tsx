import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const { data: gamificationData, error: gamificationErr } = await supabase
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

  const { data: todayItems } = await supabase
    .from("plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .eq("scheduled_for", todayStr)
    .order("day_index", { ascending: true });

  const { data: recentResults } = await supabase
    .from("user_quiz_results")
    .select("score,total,created_at,quiz_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: storiesData, error: storiesErr } = await supabase
    .from("success_stories")
    .select("id,content,created_at")
    .order("created_at", { ascending: false })
    .limit(3);
  const stories = storiesErr ? [] : (storiesData ?? []);

  const completion = todayItems?.length
    ? Math.round(
        (todayItems.filter((i) => i.status === "done").length / Math.max(1, todayItems.length)) * 100
      )
    : 0;

  const avgPercent = recentResults?.length
    ? Math.round(
        recentResults.reduce((acc, r) => acc + (r.total ? (r.score / r.total) * 100 : 0), 0) /
          recentResults.length
      )
    : 0;

  const weakEntries =
    plan?.weak_areas && typeof plan.weak_areas === "object" && !Array.isArray(plan.weak_areas)
      ? Object.entries(plan.weak_areas as any)
          .map(([topic, v]) => ({ topic, score: Number((v as any)?.score ?? v ?? 0) }))
          .filter((x) => Number.isFinite(x.score))
          .sort((a, b) => a.score - b.score)
          .slice(0, 3)
      : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {plan.mode === "group" ? "Group mode" : "Solo mode"} · {plan.pace} pace ·{" "}
            <span className="font-medium text-foreground">{todayStr}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">Streak: {streak} day{streak === 1 ? "" : "s"}</Badge>
            <Badge variant="secondary">XP: {totalXp}</Badge>
            <Badge variant="secondary">Level: {level}</Badge>
            <Badge variant="secondary">Badges: {badgesCount}</Badge>
          </div>
          <div className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full bg-primary")} style={{ width: `${levelProgress}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/plan">Open plan</Link>
          </Button>
          <Button asChild>
            <Link href="/quiz/today">Take today&apos;s quiz</Link>
          </Button>
        </div>
      </div>

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
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.topic_path}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Array.isArray(item.resource_links)
                          ? (item.resource_links as any[])
                              .slice(0, 2)
                              .map((r) => (
                                <a
                                  key={r.url}
                                  className="text-xs text-primary underline underline-offset-4"
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {r.title}
                                </a>
                              ))
                          : null}
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
            <CardTitle>Recent quizzes</CardTitle>
            <CardDescription>Fast feedback loop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentResults?.length ? (
              recentResults.map((r) => (
                <div key={r.quiz_id} className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {r.score}/{r.total}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No quiz results yet.</div>
            )}
            <Separator />
            <div className="text-sm">
              <div className="text-muted-foreground">Predicted performance</div>
              <div className="mt-1 font-medium">{avgPercent}%</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Rough estimate from your last {recentResults?.length ?? 0} quizzes.
              </div>
            </div>
            {weakEntries.length ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium">Weak areas</div>
                  {weakEntries.map((w) => (
                    <div key={w.topic} className="flex items-center justify-between text-sm">
                      <div className="text-muted-foreground">{w.topic}</div>
                      <div className="font-medium">{Math.round(w.score)}%</div>
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
          <CardTitle className="text-base">Success stories</CardTitle>
          <CardDescription>Small wins from learners like you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stories?.length ? (
            stories.map((s: any) => (
              <div key={s.id} className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                {s.content}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No stories yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
