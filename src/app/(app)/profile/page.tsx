import Link from "next/link";
import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function initialsFromName(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((piece) => piece[0]?.toUpperCase())
      .join("") || "U"
  );
}

export default async function ProfilePage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await firebase
    .from("profiles")
    .select("name,display_name,location,timezone,avatar_url,subscription_tier,pro_until,leaderboard_anonymous")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: gamData, error: gamErr } = await firebase
    .from("user_gamification")
    .select("streak_count,total_xp,level,badges")
    .eq("user_id", user.id)
    .maybeSingle();
  const gam = gamErr ? null : gamData;

  const unlockedBadges = Array.isArray(gam?.badges) ? (gam?.badges as any[]).map(String) : [];
  const { data: allBadges } = unlockedBadges.length
    ? await firebase.from("badges").select("slug,name,description").in("slug", unlockedBadges)
    : { data: [] as any[] };
  const badgeBySlug = new Map((allBadges ?? []).map((badge) => [badge.slug, badge]));

  const displayName = profile?.display_name ?? profile?.name ?? user.email ?? "Account";
  const subscriptionTier = (profile?.subscription_tier ?? "free").toUpperCase();
  const isAnonymous = Boolean(profile?.leaderboard_anonymous);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account and performance identity.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/settings">Settings</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={`${displayName} avatar`} />
              <AvatarFallback>{initialsFromName(displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{displayName}</p>
              <p className="text-sm text-muted-foreground">{user.email ?? "No email available"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {profile?.location ?? "Location not set"} • {profile?.timezone ?? "Timezone not set"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Plan: {subscriptionTier}</Badge>
            <Badge variant="secondary">{isAnonymous ? "Leaderboard: Anonymous" : "Leaderboard: Public"}</Badge>
            {profile?.pro_until ? (
              <Badge variant="outline">Pro until: {new Date(profile.pro_until).toLocaleDateString()}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

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
          {unlockedBadges.length ? (
            unlockedBadges.map((slug) => {
              const badge = badgeBySlug.get(slug);
              return (
                <Badge key={slug} variant="secondary" title={badge?.description ?? slug}>
                  {badge?.name ?? slug}
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
