import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BellDot,
  BookOpenCheck,
  ClipboardList,
  ShieldCheck,
  Siren,
  Users,
  Wrench
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getFirebaseAdminAuth, isFirebaseAdminConfigured } from "@/lib/firebase/admin-app";
import { getServerEnv } from "@/lib/env";

async function getAdminCount() {
  const auth = getFirebaseAdminAuth();
  if (!auth) return null;

  let count = 0;
  let pageToken: string | undefined;
  let page = 0;

  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const entry of result.users) {
      if (entry.customClaims?.role === "admin") count += 1;
    }
    pageToken = result.pageToken;
    page += 1;
  } while (pageToken && page < 20);

  return count;
}

export default async function AdminHomePage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  const firebase = await createFirebaseServerClient();

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
    adminCount
  ] = await Promise.all([
    firebase.from("profiles").select("user_id", { head: true, count: "exact" }),
    firebase.from("exams").select("id", { head: true, count: "exact" }),
    firebase.from("syllabi").select("id", { head: true, count: "exact" }),
    firebase.from("quizzes").select("id", { head: true, count: "exact" }),
    firebase.from("user_quiz_results").select("id", { head: true, count: "exact" }),
    firebase.from("groups").select("id", { head: true, count: "exact" }),
    firebase.from("notifications").select("id", { head: true, count: "exact" }).eq("status", "queued"),
    firebase.from("notifications").select("id", { head: true, count: "exact" }).eq("status", "failed"),
    firebase.from("group_messages").select("id", { head: true, count: "exact" }).eq("flagged", true),
    firebase
      .from("profiles")
      .select("user_id,email,name,display_name,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    firebase
      .from("notifications")
      .select("id,user_id,channel,message,created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(5),
    firebase
      .from("group_messages")
      .select("id,group_id,content,created_at")
      .eq("flagged", true)
      .order("created_at", { ascending: false })
      .limit(5),
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

  const recentProfiles = recentProfilesRes.data ?? [];
  const failedNotificationsList = failedNotificationsRes.data ?? [];
  const flaggedMessagesList = flaggedMessagesRes.data ?? [];

  const firebaseWebReady = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
  const firebaseAdminReady = isFirebaseAdminConfigured();
  const env = getServerEnv();
  const openAiReady = Boolean(env.OPENAI_API_KEY);
  const groqReady = Boolean(env.GROQ_API_KEY);
  const geminiReady = Boolean(env.GEMINI_API_KEY);
  const aiReady = openAiReady || groqReady || geminiReady;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-cyan-200/20 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Admin control center
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Platform Operations</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Manage exams, syllabus coverage, users, and operational issues from one place. Admin accounts are now isolated
              from learner flows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Users: {totalUsers}</Badge>
            <Badge variant="secondary">Admins: {totalAdmins || "-"}</Badge>
            <Badge variant="secondary">Failed alerts: {failedNotifications}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User administration</CardTitle>
            <CardDescription>Roles, support, and account fixes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{totalUsers}</div>
            <div className="text-xs text-muted-foreground">{totalAdmins || 0} admins configured</div>
            <Button asChild size="sm" className="mt-2 w-full">
              <Link href="/admin/users">
                <Users className="mr-2 h-4 w-4" /> Open users
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exam operations</CardTitle>
            <CardDescription>Exams and syllabus records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{totalExams}</div>
            <div className="text-xs text-muted-foreground">{totalSyllabi} syllabus entries stored</div>
            <Button asChild size="sm" className="mt-2 w-full" variant="secondary">
              <Link href="/admin/exams">
                <BookOpenCheck className="mr-2 h-4 w-4" /> Open exams
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learning activity</CardTitle>
            <CardDescription>Usage across quizzes and groups.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{totalResults}</div>
            <div className="text-xs text-muted-foreground">{totalQuizzes} quizzes | {totalGroups} groups</div>
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" /> Objective-question results logged
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operations health</CardTitle>
            <CardDescription>Queue and moderation pressure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{failedNotifications + flaggedMessages}</div>
            <div className="text-xs text-muted-foreground">
              {queuedNotifications} queued notifications | {flaggedMessages} flagged messages
            </div>
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Siren className="h-3.5 w-3.5" /> Items requiring admin attention
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Support and issue queue</CardTitle>
            <CardDescription>Use this to quickly resolve user-reported problems.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <BellDot className="h-4 w-4 text-amber-600" /> Failed notifications
              </div>
              {failedNotificationsList.length ? (
                <div className="space-y-2">
                  {failedNotificationsList.map((item: any) => (
                    <div key={item.id} className="rounded-lg border bg-card px-2.5 py-2 text-xs">
                      <div className="font-medium">{item.channel}</div>
                      <div className="mt-1 line-clamp-2 text-muted-foreground">{item.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No failed notifications right now.</div>
              )}
            </div>

            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-rose-600" /> Flagged group messages
              </div>
              {flaggedMessagesList.length ? (
                <div className="space-y-2">
                  {flaggedMessagesList.map((item: any) => (
                    <div key={item.id} className="rounded-lg border bg-card px-2.5 py-2 text-xs">
                      <div className="font-medium">Group: {item.group_id}</div>
                      <div className="mt-1 line-clamp-2 text-muted-foreground">{item.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No flagged messages right now.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System readiness</CardTitle>
            <CardDescription>Core service checks for admin operations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
              <span>Firebase web config</span>
              <Badge variant={firebaseWebReady ? "default" : "outline"}>{firebaseWebReady ? "ready" : "missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
              <span>Firebase admin config</span>
              <Badge variant={firebaseAdminReady ? "default" : "outline"}>{firebaseAdminReady ? "ready" : "missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
              <span>AI providers</span>
              <Badge variant={aiReady ? "default" : "outline"}>{aiReady ? "ready" : "missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
              <span>OpenAI</span>
              <Badge variant={openAiReady ? "default" : "outline"}>{openAiReady ? "ready" : "missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
              <span>Groq</span>
              <Badge variant={groqReady ? "default" : "outline"}>{groqReady ? "ready" : "missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
              <span>Gemini</span>
              <Badge variant={geminiReady ? "default" : "outline"}>{geminiReady ? "ready" : "missing"}</Badge>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
              For detailed health JSON, call `/api/health` with `x-health-secret`.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent signups</CardTitle>
          <CardDescription>Quick visibility for onboarding support and role assignment.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {recentProfiles.length ? (
            recentProfiles.map((entry: any) => {
              const label = entry.display_name || entry.name || entry.email || entry.user_id;
              return (
                <div key={entry.user_id} className="rounded-lg border bg-card px-3 py-2 text-sm">
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
          <CardTitle className="text-base">Admin quick actions</CardTitle>
          <CardDescription>Most-used workflows for support and content operations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/admin/users">
              <Wrench className="mr-2 h-4 w-4" /> Resolve user issue
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/exams">Generate/manage syllabi</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/exams">Upload syllabus documents</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/superadmin">Open superadmin route alias</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


