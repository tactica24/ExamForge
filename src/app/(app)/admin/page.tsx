import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  Megaphone,
  MessageSquareWarning,
  ShieldCheck,
  Users
} from "lucide-react";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { recomputeLeaderboardAction } from "@/app/(app)/admin/actions";

const adminRoutes = [
  {
    href: "/admin/users",
    title: "Users",
    description: "Promote roles, adjust subscriptions, and resolve access issues.",
    icon: Users
  },
  {
    href: "/admin/exams",
    title: "Exams",
    description: "Manage exams, syllabi, subjects, and generated learning content.",
    icon: BookOpenCheck
  },
  {
    href: "/admin/support",
    title: "Support",
    description: "Handle complaints, reopen cases, and track request resolution.",
    icon: MessageSquareWarning
  },
  {
    href: "/admin/referrals",
    title: "Referrals",
    description: "Create campaign codes and monitor referral operations.",
    icon: Megaphone
  },
  {
    href: "/admin/ops",
    title: "Ops",
    description: "Inspect queue pressure, notifications, and platform operations.",
    icon: Activity
  },
  {
    href: "/superadmin",
    title: "Alias",
    description: "Use the legacy superadmin alias if any external bookmark still points there.",
    icon: ShieldCheck
  }
];

export default async function AdminHomePage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(10,15,44,0.98),rgba(6,32,54,0.96))] p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,12,27,0.9)] sm:p-8">
        <div className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/75">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin workspace
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Admin control room</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75 sm:text-base">
              This is the stable admin entry surface for AWS production. From here you can manage users, exams,
              support, referrals, and operations without depending on the learner onboarding flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-white text-slate-950 hover:bg-white/90">
              <Link href="/admin/users">Open user management</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              <Link href="/admin/exams">Manage exams</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminRoutes.map((route) => {
          const Icon = route.icon;
          return (
            <Link
              key={route.href}
              href={route.href}
              className="group rounded-3xl border border-border/70 bg-card/90 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_22px_46px_-30px_hsl(var(--foreground)/0.6)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight">{route.title}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{route.description}</div>
                </div>
                <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" />
              Current operator
            </div>
            <CardTitle>Signed in as admin</CardTitle>
            <CardDescription>The admin pipeline is now independent from learner onboarding redirects.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl border bg-muted/20 px-4 py-3">
              <div className="font-medium">{user.email ?? "No email found"}</div>
              <div className="mt-1 text-muted-foreground">Use `/admin1` whenever you want the dedicated admin login.</div>
            </div>
            <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-muted-foreground">
              If a deeper admin page still fails, the problem is inside that page itself, not the admin login pipeline.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Quick action
            </div>
            <CardTitle>Leaderboard refresh</CardTitle>
            <CardDescription>Run a manual recompute without leaving the admin landing page.</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthFormState action={recomputeLeaderboardAction}>
              <SubmitButton type="submit" className="w-full" pendingText="Refreshing...">
                Recompute leaderboard now
              </SubmitButton>
            </AuthFormState>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
