import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminOpsPage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const firebase = await createFirebaseServerClient();

  const [
    notifQueued,
    notifFailed,
    notifSent,
    aiQueued,
    aiRunning,
    aiFailed,
    aiCompleted,
    recentNotifFailures,
    recentAiFailures
  ] = await Promise.all([
    firebase.from("notifications").select("id", { head: true, count: "exact" }).eq("status", "queued"),
    firebase.from("notifications").select("id", { head: true, count: "exact" }).eq("status", "failed"),
    firebase.from("notifications").select("id", { head: true, count: "exact" }).eq("status", "sent"),
    firebase.from("ai_jobs").select("id", { head: true, count: "exact" }).eq("status", "queued"),
    firebase.from("ai_jobs").select("id", { head: true, count: "exact" }).eq("status", "in_progress"),
    firebase.from("ai_jobs").select("id", { head: true, count: "exact" }).eq("status", "failed"),
    firebase.from("ai_jobs").select("id", { head: true, count: "exact" }).eq("status", "completed"),
    firebase
      .from("notifications")
      .select("id,channel,message,provider_meta,created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(8),
    firebase
      .from("ai_jobs")
      .select("id,job_type,last_error,payload,updated_at,created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ops and reliability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Queue health, delivery failures, and AI job processing status.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications queue</CardTitle>
            <CardDescription>Queued reminder deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{Number(notifQueued.count ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications failed</CardTitle>
            <CardDescription>Requires provider or destination checks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-rose-700">{Number(notifFailed.count ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI jobs queued/running</CardTitle>
            <CardDescription>Syllabus generation worker backlog</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {Number(aiQueued.count ?? 0)} / {Number(aiRunning.count ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI jobs failed/completed</CardTitle>
            <CardDescription>Worker result health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {Number(aiFailed.count ?? 0)} / {Number(aiCompleted.count ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent notification failures</CardTitle>
            <CardDescription>Inspect channel/provider_meta and destination quality.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentNotifFailures.data ?? []).length ? (
              (recentNotifFailures.data ?? []).map((row: any) => (
                <div key={row.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{row.channel}</Badge>
                    <span className="text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2">{row.message}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No recent notification failures.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent AI job failures</CardTitle>
            <CardDescription>Use these to diagnose model/access/source issues quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentAiFailures.data ?? []).length ? (
              (recentAiFailures.data ?? []).map((row: any) => (
                <div key={row.id} className="rounded-lg border bg-card px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{row.job_type}</Badge>
                    <span className="text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-rose-700">{String(row.last_error ?? "unknown_error")}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No recent AI job failures.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cron endpoints</CardTitle>
          <CardDescription>Trigger from scheduler with header `x-cron-secret`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div><code>/api/cron/reminders</code> - enqueue and process notification queue with retries.</div>
          <div><code>/api/cron/ai-jobs?limit=30</code> - process queued syllabus AI jobs.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SLO baseline</CardTitle>
          <CardDescription>Track and alert on these minimum service targets.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <div>Reminder delivery success rate (24h): target &gt;= 98%</div>
          <div>AI job completion success rate (24h): target &gt;= 95%</div>
          <div>Queue lag (time from queue to send/complete): p95 &lt;= 10 minutes</div>
        </CardContent>
      </Card>
    </div>
  );
}
