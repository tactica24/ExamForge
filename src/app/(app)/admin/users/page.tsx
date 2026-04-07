import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getAdminUserDirectory, type AdminDirectoryUser } from "@/lib/firebase/admin-users";
import {
  setUserRoleAction,
  setUserRoleByEmailAction,
  updateUserSubscriptionAction
} from "@/app/(app)/admin/users/actions";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

type ActivitySummary = {
  lastSeenAt: string | null;
  sessionCount: number;
};

function toMs(value: string | null | undefined) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function formatDateTime(value: string | null | undefined) {
  const ms = toMs(value);
  if (!ms) return "Never";
  return new Date(ms).toLocaleString();
}

function getActivityMeta(lastSeenAt: string | null) {
  const seenMs = toMs(lastSeenAt);
  if (!seenMs) {
    return {
      label: "Never active",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700"
    };
  }

  const age = Date.now() - seenMs;
  if (age <= DAY_MS) {
    return {
      label: "Active today",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
    };
  }

  if (age <= WEEK_MS) {
    return {
      label: "Active this week",
      className: "border-sky-500/30 bg-sky-500/10 text-sky-700"
    };
  }

  return {
    label: "Inactive",
    className: "border-border bg-muted/40 text-muted-foreground"
  };
}

export default async function AdminUsersPage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const firebase = await createFirebaseServerClient();
  const directory = await getAdminUserDirectory({ firebase });
  const users: AdminDirectoryUser[] = directory.ok ? directory.users.slice(0, 300) : [];
  const totalUsers = directory.ok ? directory.totalUsers : 0;
  const totalAdmins = directory.ok ? directory.totalAdmins : 0;
  const totalPro = directory.ok ? directory.totalPro : 0;
  const activityByUserId = new Map<string, ActivitySummary>();

  for (let index = 0; index < users.length; index += 30) {
    const batch = users.slice(index, index + 30).map((entry) => entry.user_id);
    const { data: sessions } = await firebase
      .from("auth_sessions")
      .select("user_id,last_seen_at")
      .in("user_id", batch);

    for (const session of sessions ?? []) {
      const userId = String((session as { user_id?: unknown }).user_id ?? "").trim();
      if (!userId) continue;

      const lastSeenAt = String((session as { last_seen_at?: unknown }).last_seen_at ?? "").trim() || null;
      const existing = activityByUserId.get(userId);
      if (!existing) {
        activityByUserId.set(userId, {
          lastSeenAt,
          sessionCount: 1
        });
        continue;
      }

      activityByUserId.set(userId, {
        lastSeenAt: toMs(lastSeenAt) > toMs(existing.lastSeenAt) ? lastSeenAt : existing.lastSeenAt,
        sessionCount: existing.sessionCount + 1
      });
    }
  }

  const visibleNeverActive = users.filter((entry) => !activityByUserId.get(entry.user_id)?.lastSeenAt).length;
  const visibleActiveToday = users.filter((entry) => {
    const lastSeenAt = activityByUserId.get(entry.user_id)?.lastSeenAt ?? null;
    return toMs(lastSeenAt) >= Date.now() - DAY_MS;
  }).length;
  const visibleActiveThisWeek = users.filter((entry) => {
    const lastSeenAt = activityByUserId.get(entry.user_id)?.lastSeenAt ?? null;
    return toMs(lastSeenAt) >= Date.now() - WEEK_MS;
  }).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,12,27,0.85)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
              <Users className="h-3.5 w-3.5" />
              User operations
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Identity, access, and support fixes</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Manage signups, admin privileges, and subscription corrections from one workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/admin">Back</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/exams">Manage exams</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Total users</div>
            <div className="mt-2 text-3xl font-semibold">{totalUsers}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Admins</div>
            <div className="mt-2 text-3xl font-semibold">{totalAdmins}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Pro subscribers</div>
            <div className="mt-2 text-3xl font-semibold">{totalPro}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Active today</div>
            <div className="mt-2 text-3xl font-semibold">{visibleActiveToday}</div>
            <div className="mt-1 text-xs text-white/60">{visibleActiveThisWeek} active in the last 7 days</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Never active</div>
            <div className="mt-2 text-3xl font-semibold">{visibleNeverActive}</div>
            <div className="mt-1 text-xs text-white/60">Signed up but no tracked session yet</div>
          </div>
        </div>
      </div>

      {!directory.ok ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin configuration required</CardTitle>
            <CardDescription>Could not load Firebase Auth users.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add Firebase admin credentials in your Vercel environment (`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`
            recommended), then redeploy.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Access control
          </div>
          <CardTitle className="text-base">Assign role by email</CardTitle>
          <CardDescription>Use this to quickly promote or demote a known account.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={setUserRoleByEmailAction}>
            <div className="grid gap-4 sm:grid-cols-[1fr_200px_auto]">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="user@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <NativeSelect id="role" name="role" defaultValue="admin">
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </NativeSelect>
              </div>
              <div className="self-end">
                <SubmitButton type="submit" pendingText="Saving...">
                  Update role
                </SubmitButton>
              </div>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Billing support
          </div>
          <CardTitle className="text-base">Support fixes</CardTitle>
          <CardDescription>Resolve subscription/tier issues when users report billing or access problems.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={updateUserSubscriptionAction}>
            <div className="grid gap-4 sm:grid-cols-[1fr_160px_160px_auto]">
              <div className="space-y-2">
                <Label htmlFor="support_email">User email</Label>
                <Input id="support_email" name="email" type="email" placeholder="user@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_tier">Tier</Label>
                <NativeSelect id="support_tier" name="tier" defaultValue="pro">
                  <option value="pro">pro</option>
                  <option value="free">free</option>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pro_days">Pro days</Label>
                <Input id="pro_days" name="pro_days" type="number" min={0} max={3650} defaultValue={30} />
              </div>
              <div className="self-end">
                <SubmitButton type="submit" pendingText="Applying...">
                  Apply fix
                </SubmitButton>
              </div>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            User activity
          </div>
          <CardTitle className="text-base">Recent signups and usage</CardTitle>
          <CardDescription>
            Newest live Firebase accounts appear first. &quot;Never active&quot; means the user has not opened a tracked
            session yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.length ? (
            users.map((entry) => {
              const label = entry.display_name || entry.name || entry.email || entry.user_id;
              const activity = activityByUserId.get(entry.user_id);
              const activityMeta = getActivityMeta(activity?.lastSeenAt ?? null);
              return (
                <div key={entry.user_id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="truncate text-sm font-medium">{label}</div>
                      <div className="truncate text-xs text-muted-foreground">{entry.email ?? "No email"}</div>
                      <div className="text-xs text-muted-foreground">
                        Signed up:{" "}
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last active: {formatDateTime(activity?.lastSeenAt ?? null)}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant={entry.role === "admin" ? "default" : "secondary"}>
                          Role: {entry.role}
                        </Badge>
                        <Badge variant="outline">
                          Tier: {entry.subscription_tier ? entry.subscription_tier : "free"}
                        </Badge>
                        <Badge variant="outline" className={activityMeta.className}>
                          {activityMeta.label}
                        </Badge>
                        <Badge variant="outline">Sessions: {activity?.sessionCount ?? 0}</Badge>
                      </div>
                    </div>

                    <div className="w-full sm:w-[220px]">
                      <AuthFormState action={setUserRoleAction}>
                        <input type="hidden" name="user_id" value={entry.user_id} />
                        <div className="flex items-center gap-2">
                          <NativeSelect name="role" defaultValue={entry.role} className="h-9">
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                          </NativeSelect>
                          <SubmitButton type="submit" pendingText="...">
                            Save
                          </SubmitButton>
                        </div>
                      </AuthFormState>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">No user profiles yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
