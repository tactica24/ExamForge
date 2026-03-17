import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { updatePlanItemStatusAction } from "@/app/(app)/plan/actions";
import { getPlanItemLesson, isPlanItemQuizCompleted } from "@/lib/plans/content";
import { describePace } from "@/lib/plans/pace";

export default async function PlanPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/dashboard");

  const start = format(new Date(), "yyyy-MM-dd");
  const end = format(addDays(new Date(), 13), "yyyy-MM-dd");

  const { data: items } = await firebase
    .from("plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .gte("scheduled_for", start)
    .lte("scheduled_for", end)
    .order("scheduled_for", { ascending: true });
  const { data: orderedItems } = await firebase
    .from("plan_items")
    .select("id,scheduled_for,day_index,status,resource_links,created_at")
    .eq("plan_id", plan.id)
    .order("scheduled_for", { ascending: true })
    .order("day_index", { ascending: true })
    .order("created_at", { ascending: true });
  const ordered = orderedItems ?? [];
  let firstIncompleteId: string | null = null;
  for (const row of ordered) {
    const completed = isPlanItemQuizCompleted(row?.resource_links) || row?.status === "done";
    if (!completed) {
      firstIncompleteId = String(row?.id ?? "") || null;
      break;
    }
  }

  const targetDate = plan.target_date ? parseISO(plan.target_date) : null;
  const daysToTarget =
    targetDate && isValid(targetDate) ? differenceInCalendarDays(targetDate, new Date()) : null;
  const paceLabel = describePace(plan.pace);

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Next 14 days | {plan.mode} mode | {paceLabel}
          {plan.target_date ? ` | Exam date: ${plan.target_date}` : ""}
          {daysToTarget != null ? ` | ${daysToTarget >= 0 ? `${daysToTarget} day(s) left` : "Exam date passed"}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>Open each topic to study the breakdown before taking the quiz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items?.length ? (
            items.map((item) => {
              const hasLesson = Boolean(getPlanItemLesson(item.resource_links));
              const isCompleted = isPlanItemQuizCompleted(item.resource_links) || item.status === "done";
              const locked = Boolean(firstIncompleteId && firstIncompleteId !== String(item.id) && !isCompleted);

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium">{item.title}</div>
                      <Badge variant={item.status === "done" ? "default" : item.status === "skipped" ? "secondary" : "outline"}>
                        {item.status}
                      </Badge>
                      {locked ? (
                        <Badge variant="outline">locked</Badge>
                      ) : (
                        <Badge variant={hasLesson ? "secondary" : "outline"}>
                          {hasLesson ? "guide ready" : "guide pending"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.scheduled_for} | {item.topic_path}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {locked ? (
                      <Button size="sm" className="w-full sm:w-auto" disabled>
                        Study topic
                      </Button>
                    ) : (
                      <Button asChild size="sm" className="w-full sm:w-auto">
                        <Link href={`/plan/${item.id}`}>{hasLesson ? "Review topic" : "Study topic"}</Link>
                      </Button>
                    )}
                    <AuthFormState action={updatePlanItemStatusAction}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <div className="grid grid-cols-3 gap-2">
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
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">No upcoming items yet. Add exam subjects from your dashboard or settings to start learning.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
