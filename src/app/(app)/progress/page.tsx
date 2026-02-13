import { redirect } from "next/navigation";
import { subDays, format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressCharts } from "@/components/progress/progress-charts";

export default async function ProgressPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const since = subDays(new Date(), 30).toISOString();
  const { data: results } = await supabase
    .from("user_quiz_results")
    .select("score,total,created_at")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const quizSeries =
    results?.map((r) => ({
      date: format(new Date(r.created_at), "MMM d"),
      percent: r.total ? Math.round((r.score / r.total) * 100) : 0
    })) ?? [];

  const avg =
    quizSeries.length ? Math.round(quizSeries.reduce((a, b) => a + b.percent, 0) / quizSeries.length) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your quiz trend over the last 30 days.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz performance</CardTitle>
          <CardDescription>Average: {avg}%</CardDescription>
        </CardHeader>
        <CardContent>
          {quizSeries.length ? (
            <ProgressCharts quizSeries={quizSeries} />
          ) : (
            <div className="text-sm text-muted-foreground">Take a quiz to see your trend.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

