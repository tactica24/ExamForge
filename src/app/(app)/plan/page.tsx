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
import { getPlanItemLesson } from "@/lib/plans/content";

export default async function PlanPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const start = format(new Date(), "yyyy-MM-dd");
  const end = format(addDays(new Date(), 13), "yyyy-MM-dd");

  const { data: items } = await firebase
    .from("plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .gte("scheduled_for", start)
    .lte("scheduled_for", end)
    .order("scheduled_for", { ascending: true });

  const targetDate = plan.target_date ? parseISO(plan.target_date) : null;
  const daysToTarget =
    targetDate && isValid(targetDate) ? differenceInCalendarDays(targetDate, new Date()) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Next 14 days | {plan.mode} mode | {plan.pace} pace
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
                      <Badge variant={hasLesson ? "secondary" : "outline"}>{hasLesson ? "guide ready" : "guide pending"}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.scheduled_for} | {item.topic_path}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button asChild size="sm" className="w-full sm:w-auto">
                      <Link href={`/plan/${item.id}`}>{hasLesson ? "Review topic" : "Study topic"}</Link>
                    </Button>
                    <AuthFormState action={updatePlanItemStatusAction}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <div className="grid grid-cols-3 gap-2">
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
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">No upcoming items. Create a plan in onboarding.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
