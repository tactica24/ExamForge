import { redirect } from "next/navigation";
import { format, addDays } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { updatePlanItemStatusAction } from "@/app/(app)/plan/actions";

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

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Next 14 days | {plan.mode} mode | {plan.pace} pace
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>Mark items done to build momentum.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items?.length ? (
            items.map((item) => (
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
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.scheduled_for} | {item.topic_path}
                  </div>
                </div>

                <AuthFormState action={updatePlanItemStatusAction}>
                  <input type="hidden" name="item_id" value={item.id} />
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                    <Button type="submit" name="status" value="done" variant="secondary" size="sm" className="w-full sm:w-auto">
                      Done
                    </Button>
                    <Button type="submit" name="status" value="skipped" variant="outline" size="sm" className="w-full sm:w-auto">
                      Skip
                    </Button>
                    <Button type="submit" name="status" value="todo" variant="ghost" size="sm" className="w-full sm:w-auto">
                      Reset
                    </Button>
                  </div>
                </AuthFormState>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No upcoming items. Create a plan in onboarding.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
