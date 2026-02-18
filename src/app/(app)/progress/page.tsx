import { redirect } from "next/navigation";
import { subDays, format, addDays, isValid } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressCharts } from "@/components/progress/progress-charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return isValid(d) ? d : null;
}

export default async function ProgressPage(props: { searchParams: Promise<{ start?: string; end?: string }> }) {
  const sp = await props.searchParams;
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const startDate = toDate(sp.start) ?? subDays(today, 30);
  const endDate = toDate(sp.end) ?? today;
  const since = startDate.toISOString();
  const until = addDays(endDate, 1).toISOString();
  const { data: results } = await firebase
    .from("user_quiz_results")
    .select("score,total,created_at,quiz_id")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .lte("created_at", until)
    .order("created_at", { ascending: true });

  const quizSeries =
    results?.map((r) => ({
      date: format(new Date(r.created_at), "MMM d"),
      percent: r.total ? Math.round((r.score / r.total) * 100) : 0
    })) ?? [];

  const avg =
    quizSeries.length ? Math.round(quizSeries.reduce((a, b) => a + b.percent, 0) / quizSeries.length) : 0;

  const quizIds = Array.from(new Set((results ?? []).map((r) => r.quiz_id).filter(Boolean)));
  const { data: quizzes } = quizIds.length
    ? await firebase.from("quizzes").select("id,subject,quiz_type").in("id", quizIds)
    : { data: [] as any[] };
  const quizById = new Map((quizzes ?? []).map((q) => [q.id, q]));

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">Filter and review your objective-question history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date range</CardTitle>
          <CardDescription>Select a range to review past objective questions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="start">Start date</Label>
              <Input id="start" name="start" type="date" defaultValue={format(startDate, "yyyy-MM-dd")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End date</Label>
              <Input id="end" name="end" type="date" defaultValue={format(endDate, "yyyy-MM-dd")} />
            </div>
            <Button type="submit" className="self-end">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objective-question performance</CardTitle>
          <CardDescription>Average: {avg}%</CardDescription>
        </CardHeader>
        <CardContent>
          {quizSeries.length ? (
            <ProgressCharts quizSeries={quizSeries} />
          ) : (
            <div className="text-sm text-muted-foreground">Take objective questions to see your trend.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objective-question sessions in range</CardTitle>
          <CardDescription>Select a session to review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {results?.length ? (
            results.map((r) => {
              const quiz = quizById.get(r.quiz_id);
              return (
                <div key={r.quiz_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{quiz?.subject ?? "Subject"}</div>
                    <div className="text-xs text-muted-foreground">
                      {quiz?.quiz_type ?? "objective"} | {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {r.score}/{r.total}
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <a href={`/quiz/${r.quiz_id}/review`}>Review</a>
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">No objective-question sessions in this range.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
