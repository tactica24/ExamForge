import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

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
    .limit(5);

  const completion = todayItems?.length
    ? Math.round(
        (todayItems.filter((i) => i.status === "done").length / Math.max(1, todayItems.length)) * 100
      )
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {plan.mode === "group" ? "Group mode" : "Solo mode"} · {plan.pace} pace ·{" "}
            <span className="font-medium text-foreground">{todayStr}</span>
          </p>
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
            <Button asChild variant="secondary" className="w-full">
              <Link href="/progress">View progress</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

