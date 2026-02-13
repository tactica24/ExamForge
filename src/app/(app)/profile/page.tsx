import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name,display_name,subscription_tier,pro_until,leaderboard_anonymous")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: gamData, error: gamErr } = await supabase
    .from("user_gamification")
    .select("streak_count,total_xp,level,badges")
    .eq("user_id", user.id)
    .maybeSingle();
  const gam = gamErr ? null : gamData;

  const unlocked = Array.isArray(gam?.badges) ? (gam?.badges as any[]).map(String) : [];
  const { data: allBadges } = unlocked.length
    ? await supabase.from("badges").select("slug,name,description").in("slug", unlocked)
    : { data: [] as any[] };
  const bySlug = new Map((allBadges ?? []).map((b) => [b.slug, b]));

  const name = profile?.display_name ?? profile?.name ?? user.email ?? "Account";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">{name}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/settings">Settings</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Streak</CardTitle>
            <CardDescription>Consistency wins.</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{gam?.streak_count ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">XP</CardTitle>
            <CardDescription>Your study points.</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{gam?.total_xp ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Level</CardTitle>
            <CardDescription>Every 100 XP.</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{gam?.level ?? 1}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Badges</CardTitle>
          <CardDescription>Unlocked achievements.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {unlocked.length ? (
            unlocked.map((slug) => {
              const b = bySlug.get(slug);
              return (
                <Badge key={slug} variant="secondary" title={b?.description ?? slug}>
                  {b?.name ?? slug}
                </Badge>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">No badges yet. Complete a quiz to unlock your first.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
