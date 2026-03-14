import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BellDot,
  BookOpenCheck,
  ClipboardList,
  Cpu,
  Gauge,
  Megaphone,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoUploader } from "@/components/admin/logo-uploader";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { recomputeLeaderboardAction } from "@/app/(app)/admin/actions";
import { getBrandingSettings } from "@/lib/branding";
import { createBackendServerClient } from "@/lib/backend/server";
import { getAppBackendProvider } from "@/lib/backend/provider";
import { isAwsBackendConfigured } from "@/lib/aws/config";
import { getServerEnv } from "@/lib/env";

async function getAdminCount() {
  const backend = await createBackendServerClient();
  const { count } = await backend.from("profiles").select("user_id", { head: true, count: "exact" }).eq("role", "admin");
  return count ?? 0;
}

function ratio(value: number, total: number) {
  if (!total) return 0;
  return Math.max(6, Math.min(100, Math.round((value / total) * 100)));
}

export default async function AdminHomePage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  const backend = await createBackendServerClient();
  const branding = await getBrandingSettings();

  const [
    usersCountRes,
    examsCountRes,
    syllabiCountRes,
    quizzesCountRes,
    resultsCountRes,
    groupsCountRes,
    queuedNotifRes,
    failedNotifRes,
    flaggedRes,
    recentProfilesRes,
    failedNotificationsRes,
    flaggedMessagesRes,
    leaderboardSnapshotRes,
    pendingSupportRes,
    adminCount
  ] = await Promise.all([
    backend.from("profiles").select("user_id", { head: true, count: "exact" }),
    backend.from("exams").select("id", { head: true, count: "exact" }),
    backend.from("syllabi").select("id", { head: true, count: "exact" }),
    backend.from("quizzes").select("id", { head: true, count: "exact" }),
    backend.from("user_quiz_results").select("id", { head: true, count: "exact" }),
    backend.from("groups").select("id", { head: true, count: "exact" }),
    backend.from("notifications").select("id", { head: true, count: "exact" }).eq("status", "queued"),
    backend.from("notifications").select("id", { head: true, count: "exact" }).eq("status", "failed"),
    backend.from("group_messages").select("id", { head: true, count: "exact" }).eq("flagged", true),
    backend
      .from("profiles")
      .select("user_id,email,name,display_name,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    backend
      .from("notifications")
      .select("id,user_id,channel,message,created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(5),
    backend
      .from("group_messages")
      .select("id,group_id,content,created_at")
      .eq("flagged", true)
      .order("created_at", { ascending: false })
      .limit(5),
    backend
      .from("leaderboard_entries")
      .select("computed_at")
      .eq("period", "weekly")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    backend.from("contact_requests").select("id", { head: true, count: "exact" }).in("status", ["new", "in_progress"]),
    getAdminCount()
  ]);

  const totalUsers = Number(usersCountRes.count ?? 0);
  const totalAdmins = Number(adminCount ?? 0);
  const totalExams = Number(examsCountRes.count ?? 0);
  const totalSyllabi = Number(syllabiCountRes.count ?? 0);
  const totalQuizzes = Number(quizzesCountRes.count ?? 0);
  const totalResults = Number(resultsCountRes.count ?? 0);
  const totalGroups = Number(groupsCountRes.count ?? 0);
  const queuedNotifications = Number(queuedNotifRes.count ?? 0);
  const failedNotifications = Number(failedNotifRes.count ?? 0);
  const flaggedMessages = Number(flaggedRes.count ?? 0);
  const totalAttentionItems = failedNotifications + flaggedMessages;
  const pendingSupportIssues = Number(pendingSupportRes.count ?? 0);

  const recentProfiles = recentProfilesRes.data ?? [];
  const failedNotificationsList = failedNotificationsRes.data ?? [];
  const flaggedMessagesList = flaggedMessagesRes.data ?? [];
  const lastLeaderboardComputedAt = leaderboardSnapshotRes.data?.computed_at
    ? new Date(leaderboardSnapshotRes.data.computed_at).toLocaleString()
    : "Not computed yet";

  const backendProvider = getAppBackendProvider();
  const awsReady = isAwsBackendConfigured();
  const env = getServerEnv();
  const openAiReady = Boolean(env.OPENAI_API_KEY);
  const groqReady = Boolean(env.GROQ_API_KEY);
  const geminiReady = Boolean(env.GEMINI_API_KEY);
  const twilioReady = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
  const resendReady = Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
  const cronReady = Boolean(env.APP_CRON_SECRET);
  const aiReady = openAiReady || groqReady || geminiReady;
  const readinessScore = [
    backendProvider === "aws",
    awsReady,
    aiReady,
    twilioReady,
    resendReady,
    cronReady
  ].filter(Boolean).length;

  const routeCards = [
    {
      title: "Users",
      description: "Access, role assignment, subscription fixes",
      href: "/admin/users",
      metric: `${totalUsers}`,
      detail: `${totalAdmins} admins`,
      icon: Users
    },
    {
      title: "Exams",
      description: "Exam catalogue, syllabus generation, content ops",
      href: "/admin/exams",
      metric: `${totalExams}`,
      detail: `${totalSyllabi} syllabus entries`,
      icon: BookOpenCheck
    },
    {
      title: "Support",
      description: "Pending and resolved complaints with ownership",
      href: "/admin/support",
      metric: `${pendingSupportIssues}`,
      detail: "Open support queue",
      icon: MessageSquareWarning
    },
    {
      title: "Referrals",
      description: "Campaign tracking, conversion, influencer codes",
      href: "/admin/referrals",
      metric: `${Math.max(0, totalUsers - totalAdmins)}`,
      detail: "Growth workspace",
      icon: Megaphone
    },
    {
      title: "Ops",
      description: "Queues, delivery failures, worker reliability",
      href: "/admin/ops",
      metric: `${queuedNotifications + totalAttentionItems}`,
      detail: "Live operations load",
      icon: Activity
    }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_32%),linear-gradient(135deg,rgba(10,15,44,0.98),rgba(6,32,54,0.96))] p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,12,27,0.9)] sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/75">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin control room
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Grafana-style command center for platform operations, growth, and support.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-white/75 sm:text-base">
                The current admin tools are still here, but the workspace is now structured like an operations board:
                route clusters, live pressure signals, system readiness, and direct action panels from one surface.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.22em] text-white/60">Workspace load</div>
                <div className="mt-2 text-3xl font-semibold">{totalUsers}</div>
                <div className="mt-1 text-sm text-white/70">Learner profiles being managed</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.22em] text-white/60">Attention items</div>
                <div className="mt-2 text-3xl font-semibold">{totalAttentionItems}</div>
                <div className="mt-1 text-sm text-white/70">Failures and moderation flags</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.22em] text-white/60">Readiness score</div>
                <div className="mt-2 text-3xl font-semibold">{readinessScore}/6</div>
                <div className="mt-1 text-sm text-white/70">Core services currently configured</div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/15 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-white/55">Signal board</div>
                <div className="mt-1 text-lg font-semibold">Live operational posture</div>
              </div>
              <Gauge className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <div className="mb-1 flex items-center justify-between text-white/70">
                  <span>Notifications queued</span>
                  <span>{queuedNotifications}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${ratio(queuedNotifications, totalUsers || 1)}` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-white/70">
                  <span>Failures needing action</span>
                  <span>{failedNotifications}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-amber-300" style={{ width: `${ratio(failedNotifications, totalUsers || 1)}` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-white/70">
                  <span>Flagged community items</span>
                  <span>{flaggedMessages}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-rose-300" style={{ width: `${ratio(flaggedMessages, totalGroups || 1)}` }} />
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button asChild size="sm" className="bg-white text-slate-950 hover:bg-white/90">
                <Link href="/admin/ops">Open ops console</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link href="/admin/users">Handle support case</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {routeCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/10 p-5 ring-1 ring-white/30 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_22px_46px_-30px_hsl(var(--foreground)/0.6)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight">{card.title}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{card.description}</div>
                </div>
                <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div className="text-3xl font-semibold tracking-tight">{card.metric}</div>
                <div className="text-xs text-muted-foreground">{card.detail}</div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              Service matrix
            </div>
            <CardTitle>Core platform readiness</CardTitle>
            <CardDescription>Critical dependencies for learner experience, billing, messaging, and AI workflows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Backend provider", backendProvider === "aws"],
              ["AWS backend", awsReady],
              ["AI routing", aiReady],
              ["OpenAI", openAiReady],
              ["Groq", groqReady],
              ["Gemini", geminiReady],
              ["Twilio", twilioReady],
              ["Resend", resendReady],
              ["Cron secret", cronReady]
            ].map(([label, ready]) => (
              <div key={String(label)} className="rounded-2xl border bg-card/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{label}</span>
                  <Badge variant={ready ? "default" : "outline"}>{ready ? "ready" : "missing"}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Branding
            </div>
            <CardTitle>Shared app identity</CardTitle>
            <CardDescription>Upload once and reuse the logo across the public site, auth screens, and admin workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoUploader logoUrl={branding.logoUrl} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <BellDot className="h-3.5 w-3.5" />
              Action stream
            </div>
            <CardTitle>Support and moderation queue</CardTitle>
            <CardDescription>What needs attention first across messaging, delivery, and trust signals.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Failed notifications</div>
                <Badge variant={failedNotifications ? "outline" : "secondary"}>{failedNotifications}</Badge>
              </div>
              {failedNotificationsList.length ? (
                failedNotificationsList.map((item: any) => (
                  <div key={item.id} className="rounded-xl border bg-card px-3 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.channel}</span>
                      <span className="text-muted-foreground">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-muted-foreground">{item.message}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No failed notifications right now.</div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Flagged messages</div>
                <Badge variant={flaggedMessages ? "outline" : "secondary"}>{flaggedMessages}</Badge>
              </div>
              {flaggedMessagesList.length ? (
                flaggedMessagesList.map((item: any) => (
                  <div key={item.id} className="rounded-xl border bg-card px-3 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Group {item.group_id}</span>
                      <span className="text-muted-foreground">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-muted-foreground">{item.content}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No flagged messages right now.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Intake
            </div>
            <CardTitle>Recent signups</CardTitle>
            <CardDescription>Fresh accounts for onboarding checks and role assignment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentProfiles.length ? (
              recentProfiles.map((entry: any) => {
                const label = entry.display_name || entry.name || entry.email || entry.user_id;
                return (
                  <div key={entry.user_id} className="rounded-2xl border bg-card px-4 py-3 text-sm">
                    <div className="truncate font-medium">{label}</div>
                    <div className="truncate text-xs text-muted-foreground">{entry.email || "No email"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Unknown signup date"}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">No user profiles yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
              Playbooks
            </div>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>High-frequency operations and admin shortcuts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              Weekly leaderboard last computed: {lastLeaderboardComputedAt}
            </div>
            <AuthFormState action={recomputeLeaderboardAction}>
              <SubmitButton type="submit" pendingText="Refreshing..." size="sm" className="w-full">
                Recompute leaderboard now
              </SubmitButton>
            </AuthFormState>
            <Button asChild className="w-full">
              <Link href="/admin/users">
                <Users className="mr-2 h-4 w-4" /> Resolve user issue
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/admin/support">
                <MessageSquareWarning className="mr-2 h-4 w-4" /> Open support queue
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/exams">
                <ClipboardList className="mr-2 h-4 w-4" /> Manage syllabi
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/referrals">
                <Megaphone className="mr-2 h-4 w-4" /> Open referral analytics
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/ops">
                <Activity className="mr-2 h-4 w-4" /> Inspect queue pressure
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/superadmin">Open superadmin alias</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              Throughput
            </div>
            <CardTitle>Platform activity lanes</CardTitle>
            <CardDescription>High-level load across learner activity, content inventory, and collaboration.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Assessment</div>
              <div className="mt-2 text-3xl font-semibold">{totalResults}</div>
              <div className="mt-1 text-sm text-muted-foreground">{totalQuizzes} quizzes generated</div>
            </div>
            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Community</div>
              <div className="mt-2 text-3xl font-semibold">{totalGroups}</div>
              <div className="mt-1 text-sm text-muted-foreground">Active group rooms available</div>
            </div>
            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Curriculum</div>
              <div className="mt-2 text-3xl font-semibold">{totalSyllabi}</div>
              <div className="mt-1 text-sm text-muted-foreground">Stored syllabus documents and topics</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              SLO
            </div>
            <CardTitle>Reliability baseline</CardTitle>
            <CardDescription>Keep these targets visible while scaling the control room.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border px-4 py-3">Reminder delivery success rate: target &gt;= 98%</div>
            <div className="rounded-2xl border px-4 py-3">AI job completion success rate: target &gt;= 95%</div>
            <div className="rounded-2xl border px-4 py-3">Queue lag p95: target &lt;= 10 minutes</div>
            <div className="rounded-2xl border px-4 py-3">Health JSON: call <code>/api/health</code> with <code>x-health-secret</code></div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
