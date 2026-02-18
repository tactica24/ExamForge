import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getAppUrl } from "@/lib/app-url";

export default async function ParentViewPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  const res = await fetch(`${getAppUrl()}/api/parent/${token}`, {
    cache: "no-store"
  });
  const json = await res.json().catch(() => null);

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container pb-16 pt-12">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Parent view</h1>
          <p className="text-sm text-muted-foreground">Read-only progress snapshot.</p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{json?.ok ? json.name : "Unavailable"}</CardTitle>
              <CardDescription>{json?.ok ? json.label ?? "Progress" : json?.message ?? "Not found."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-3">
                <div className="text-xs text-muted-foreground">Streak</div>
                <div className="text-lg font-semibold">{json?.ok ? json.streak : 0}</div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="text-xs text-muted-foreground">XP</div>
                <div className="text-lg font-semibold">{json?.ok ? json.xp : 0}</div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="text-xs text-muted-foreground">Avg (30d)</div>
                <div className="text-lg font-semibold">{json?.ok ? `${json.avg30}%` : "N/A"}</div>
              </div>
              <div className="sm:col-span-3">
                <Button asChild variant="secondary">
                  <Link href="/">Back to ACE NAIJA</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            This link is read-only and can be revoked in Settings by the learner.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
