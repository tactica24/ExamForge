import Link from "next/link";
import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Period = "weekly" | "monthly" | "all_time";

function displayPeriod(p: Period) {
  if (p === "weekly") return "Weekly";
  if (p === "monthly") return "Monthly";
  return "All-time";
}

export default async function LeaderboardPage(props: { searchParams: Promise<{ period?: string }> }) {
  const sp = await props.searchParams;
  const period = (sp.period === "monthly" || sp.period === "all_time" ? sp.period : "weekly") as Period;

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entries } = await firebase
    .from("leaderboard_entries")
    .select("user_id,score,rank,computed_at")
    .eq("period", period)
    .order("rank", { ascending: true })
    .limit(50);

  const userIds = (entries ?? []).map((e) => e.user_id);
  const { data: pubs } = userIds.length
    ? await firebase.from("profile_public").select("user_id,display_name,anonymous").in("user_id", userIds)
    : { data: [] as any[] };
  const byId = new Map((pubs ?? []).map((p) => [p.user_id, p]));

  const mine = entries?.find((e) => e.user_id === user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Compete on XP. Stay consistent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={period === "weekly" ? "default" : "secondary"} size="sm">
            <Link href="/leaderboard?period=weekly">Weekly</Link>
          </Button>
          <Button asChild variant={period === "monthly" ? "default" : "secondary"} size="sm">
            <Link href="/leaderboard?period=monthly">Monthly</Link>
          </Button>
          <Button asChild variant={period === "all_time" ? "default" : "secondary"} size="sm">
            <Link href="/leaderboard?period=all_time">All-time</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{displayPeriod(period)} top 50</CardTitle>
          <CardDescription>Ranks update regularly based on completed objective questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mine ? (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              Your rank: <span className="font-medium">#{mine.rank}</span> | XP:{" "}
              <span className="font-medium">{mine.score}</span>
            </div>
          ) : null}
          <Separator />
          {entries?.length ? (
            <div className="space-y-2">
              {entries.map((e) => {
                const p = byId.get(e.user_id);
                const name = p?.anonymous ? "Anonymous" : p?.display_name ?? `Learner-${e.user_id.slice(0, 6)}`;
                return (
                  <div key={e.user_id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">#{e.rank}</Badge>
                      <div className="text-sm font-medium">{name}</div>
                      {e.user_id === user.id ? <Badge>you</Badge> : null}
                    </div>
                    <div className="text-sm font-medium">{e.score} XP</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No entries yet. Complete objective questions to earn XP and appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
