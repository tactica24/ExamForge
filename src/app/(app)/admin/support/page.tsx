import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, LifeBuoy, MessageSquareWarning, ShieldCheck, Sparkles } from "lucide-react";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/app/(app)/admin/guard";
import {
  claimSupportIssueAction,
  reopenSupportIssueAction,
  resolveSupportIssueAction
} from "@/app/(app)/admin/support/actions";
import { createBackendServerClient } from "@/lib/backend/server";

export const dynamic = "force-dynamic";

type IssueRow = {
  id: string;
  name: string | null;
  email: string | null;
  topic: string | null;
  message: string;
  source: string | null;
  status: string | null;
  created_at: string | null;
  assigned_admin_email: string | null;
  handled_at: string | null;
  resolution_notes: string | null;
};

function cleanText(value: unknown, max = 200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function selectByInBatches(args: {
  backend: Awaited<ReturnType<typeof createBackendServerClient>>;
  table: string;
  select: string;
  field: string;
  values: string[];
}) {
  if (!args.values.length) return [];
  const rows: any[] = [];
  for (const batch of chunk(args.values, 25)) {
    const { data } = await args.backend.from(args.table).select(args.select).in(args.field, batch);
    rows.push(...(data ?? []));
  }
  return rows;
}

function normalizeIssue(row: any): IssueRow {
  return {
    id: cleanText(row.id, 80),
    name: cleanText(row.name, 120) || null,
    email: cleanText(row.email, 180) || null,
    topic: cleanText(row.topic, 120) || null,
    message: cleanText(row.message, 2000),
    source: cleanText(row.source, 80) || null,
    status: cleanText(row.status, 40) || null,
    created_at: cleanText(row.created_at, 40) || null,
    assigned_admin_email: cleanText(row.assigned_admin_email, 180) || null,
    handled_at: cleanText(row.handled_at, 40) || null,
    resolution_notes: cleanText(row.resolution_notes, 1000) || null
  };
}

export default async function AdminSupportPage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const backend = await createBackendServerClient();

  const [
    pendingRes,
    resolvedRes,
    pendingCountRes,
    resolvedCountRes,
    failedNotifCountRes,
    failedNotificationsRes,
    failedAiCountRes,
    failedAiRes
  ] = await Promise.all([
    backend
      .from("contact_requests")
      .select("*")
      .in("status", ["new", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(30),
    backend
      .from("contact_requests")
      .select("*")
      .in("status", ["resolved", "handled"])
      .order("created_at", { ascending: false })
      .limit(30),
    backend.from("contact_requests").select("id", { head: true, count: "exact" }).in("status", ["new", "in_progress"]),
    backend.from("contact_requests").select("id", { head: true, count: "exact" }).in("status", ["resolved", "handled"]),
    backend.from("notifications").select("id", { head: true, count: "exact" }).eq("status", "failed"),
    backend
      .from("notifications")
      .select("id,channel,message,created_at,user_id")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(6),
    backend.from("ai_jobs").select("id", { head: true, count: "exact" }).eq("status", "failed"),
    backend
      .from("ai_jobs")
      .select("id,job_type,last_error,created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(6)
  ]);

  const pendingIssues = (pendingRes.data ?? []).map(normalizeIssue).filter((row) => row.id);
  const resolvedIssues = (resolvedRes.data ?? []).map(normalizeIssue).filter((row) => row.id);
  const pendingCount = Number(pendingCountRes.count ?? pendingIssues.length);
  const resolvedCount = Number(resolvedCountRes.count ?? resolvedIssues.length);
  const failedNotificationCount = Number(failedNotifCountRes.count ?? 0);
  const failedAiCount = Number(failedAiCountRes.count ?? 0);

  const issueEmails = Array.from(new Set([...pendingIssues, ...resolvedIssues].map((issue) => issue.email).filter(Boolean))) as string[];
  const relatedProfiles = await selectByInBatches({
    backend,
    table: "profiles",
    select: "user_id,email,display_name,name,subscription_tier",
    field: "email",
    values: issueEmails
  });

  const profileByEmail = new Map<string, { label: string; tier: string | null }>();
  for (const row of relatedProfiles) {
    const email = cleanText((row as any).email, 180);
    if (!email) continue;
    profileByEmail.set(email, {
      label:
        cleanText((row as any).display_name, 120) ||
        cleanText((row as any).name, 120) ||
        email,
      tier: cleanText((row as any).subscription_tier, 30) || null
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,12,27,0.85)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
              <LifeBuoy className="h-3.5 w-3.5" />
              Support plane
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Pending and resolved user issues</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              This queue is built to reduce confusion across multiple admins. Issues can be claimed, resolved, or reopened,
              and each item shows ownership so user challenges are handled cleanly.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/admin/users">Open user tools</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/ops">Open ops failures</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Pending issues</div>
            <div className="mt-2 text-3xl font-semibold">{pendingCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Resolved issues</div>
            <div className="mt-2 text-3xl font-semibold">{resolvedCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Failed notifications</div>
            <div className="mt-2 text-3xl font-semibold">{failedNotificationCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Failed AI jobs</div>
            <div className="mt-2 text-3xl font-semibold">{failedAiCount}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <MessageSquareWarning className="h-3.5 w-3.5" />
              Pending lane
            </div>
            <CardTitle>Pending issues</CardTitle>
            <CardDescription>New or claimed requests that still require follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingIssues.length ? (
              pendingIssues.map((issue) => {
                const profile = issue.email ? profileByEmail.get(issue.email) : null;
                const claimedByCurrentAdmin = issue.assigned_admin_email && issue.assigned_admin_email === user.email;

                return (
                  <div key={issue.id} className="rounded-2xl border bg-card/80 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={issue.status === "in_progress" ? "default" : "secondary"}>
                            {issue.status === "in_progress" ? "claimed" : "new"}
                          </Badge>
                          {issue.topic ? <Badge variant="outline">{issue.topic}</Badge> : null}
                          {issue.source ? <Badge variant="outline">{issue.source}</Badge> : null}
                          {profile?.tier ? <Badge variant="outline">Tier: {profile.tier}</Badge> : null}
                        </div>
                        <div className="text-sm font-semibold">
                          {issue.name || profile?.label || issue.email || "Unnamed contact"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {issue.email || "No email"} | {issue.created_at ? new Date(issue.created_at).toLocaleString() : "Unknown time"}
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{issue.message}</p>
                        <div className="text-xs text-muted-foreground">
                          Owner: {issue.assigned_admin_email || "Unassigned"}
                        </div>
                      </div>

                      <div className="w-full max-w-sm space-y-3">
                        {!issue.assigned_admin_email ? (
                          <AuthFormState action={claimSupportIssueAction}>
                            <input type="hidden" name="request_id" value={issue.id} />
                            <SubmitButton type="submit" pendingText="Claiming..." className="w-full">
                              Claim issue
                            </SubmitButton>
                          </AuthFormState>
                        ) : !claimedByCurrentAdmin ? (
                          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            Another admin is currently handling this issue.
                          </div>
                        ) : null}

                        <AuthFormState action={resolveSupportIssueAction}>
                          <input type="hidden" name="request_id" value={issue.id} />
                          <Textarea
                            name="resolution_notes"
                            className="min-h-[96px]"
                            placeholder="Add a short resolution note before closing this issue."
                          />
                          <div className="mt-3 flex gap-2">
                            <SubmitButton type="submit" pendingText="Resolving..." className="flex-1">
                              Mark resolved
                            </SubmitButton>
                            <Button asChild variant="outline" className="flex-1">
                              <Link href="/admin/users">User tools</Link>
                            </Button>
                          </div>
                        </AuthFormState>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                No pending support issues right now.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                Live failures
              </div>
              <CardTitle>App failure inbox</CardTitle>
              <CardDescription>Recent system issues that may trigger or explain user complaints.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(failedNotificationsRes.data ?? []).map((row: any) => (
                <div key={row.id} className="rounded-xl border bg-card px-3 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{row.channel}</Badge>
                    <span className="text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-muted-foreground">{row.message}</div>
                </div>
              ))}
              {(failedAiRes.data ?? []).map((row: any) => (
                <div key={row.id} className="rounded-xl border bg-card px-3 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{row.job_type}</Badge>
                    <span className="text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-rose-700">{cleanText(row.last_error, 240) || "unknown_error"}</div>
                </div>
              ))}
              {!failedNotificationsRes.data?.length && !failedAiRes.data?.length ? (
                <div className="text-sm text-muted-foreground">No recent failures in the live inbox.</div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Workflow
              </div>
              <CardTitle>How admins should use this queue</CardTitle>
              <CardDescription>Simple ownership rules to avoid collisions when the team grows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border px-4 py-3">Claim a new issue before replying or changing anything.</div>
              <div className="rounded-xl border px-4 py-3">Resolve with a note so other admins know what was done.</div>
              <div className="rounded-xl border px-4 py-3">Reopen resolved items if the user reports the problem again.</div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Archive
          </div>
          <CardTitle>Resolved issues</CardTitle>
          <CardDescription>Closed items with ownership and resolution context for audit and team clarity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {resolvedIssues.length ? (
            resolvedIssues.map((issue) => (
              <div key={issue.id} className="rounded-2xl border bg-card/80 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>resolved</Badge>
                      {issue.topic ? <Badge variant="outline">{issue.topic}</Badge> : null}
                    </div>
                    <div className="text-sm font-semibold">{issue.name || issue.email || "Unnamed contact"}</div>
                    <div className="text-xs text-muted-foreground">
                      {issue.email || "No email"} | {issue.handled_at ? new Date(issue.handled_at).toLocaleString() : "Resolved"}
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{issue.message}</p>
                    <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      Resolution: {issue.resolution_notes || "No resolution note added."}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Resolved by: {issue.assigned_admin_email || "Unknown admin"}
                    </div>
                  </div>
                  <div className="w-full max-w-xs">
                    <AuthFormState action={reopenSupportIssueAction}>
                      <input type="hidden" name="request_id" value={issue.id} />
                      <SubmitButton type="submit" pendingText="Reopening..." variant="outline" className="w-full">
                        Reopen issue
                      </SubmitButton>
                    </AuthFormState>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
              No resolved issues yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

