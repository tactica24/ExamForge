import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Sparkles, Users } from "lucide-react";
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
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-app";
import {
  setUserRoleAction,
  setUserRoleByEmailAction,
  updateUserSubscriptionAction
} from "@/app/(app)/admin/users/actions";

export const dynamic = "force-dynamic";

type AdminUserRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  display_name: string | null;
  subscription_tier: string | null;
  created_at: string | null;
  role: "admin" | "user";
};

async function getRoleMap() {
  const auth = getFirebaseAdminAuth();
  if (!auth) return { ok: false as const, roleByUid: new Map<string, "admin" | "user">() };

  const roleByUid = new Map<string, "admin" | "user">();
  let pageToken: string | undefined;
  let page = 0;

  do {
    const result = await auth.listUsers(1000, pageToken);
    result.users.forEach((entry) => {
      const role = entry.customClaims?.role === "admin" ? "admin" : "user";
      roleByUid.set(entry.uid, role);
    });
    pageToken = result.pageToken;
    page += 1;
  } while (pageToken && page < 20);

  return { ok: true as const, roleByUid };
}

export default async function AdminUsersPage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const firebase = await createFirebaseServerClient();
  const { data: profiles } = await firebase
    .from("profiles")
    .select("user_id,email,name,display_name,subscription_tier,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const roles = await getRoleMap();
  const roleByUid = roles.roleByUid;

  const users: AdminUserRow[] = (profiles ?? []).map((profile: any) => ({
    user_id: String(profile.user_id),
    email: profile.email ? String(profile.email) : null,
    name: profile.name ? String(profile.name) : null,
    display_name: profile.display_name ? String(profile.display_name) : null,
    subscription_tier: profile.subscription_tier ? String(profile.subscription_tier) : null,
    created_at: profile.created_at ? String(profile.created_at) : null,
    role: roleByUid.get(String(profile.user_id)) ?? "user"
  }));

  const totalUsers = users.length;
  const totalAdmins = users.filter((entry) => entry.role === "admin").length;
  const totalPro = users.filter((entry) => (entry.subscription_tier ?? "").toLowerCase() === "pro").length;

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

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
        </div>
      </div>

      {!roles.ok ? (
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
          <CardTitle className="text-base">Recent signups</CardTitle>
          <CardDescription>Newest profiles appear first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.length ? (
            users.map((entry) => {
              const label = entry.display_name || entry.name || entry.email || entry.user_id;
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
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant={entry.role === "admin" ? "default" : "secondary"}>
                          Role: {entry.role}
                        </Badge>
                        <Badge variant="outline">
                          Tier: {entry.subscription_tier ? entry.subscription_tier : "free"}
                        </Badge>
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
