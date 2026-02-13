import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function GroupsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id,groups(*)")
    .eq("user_id", user.id);

  const groups = memberships?.map((m: any) => m.groups).filter(Boolean) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Collaborative mode: chat, challenges, and peer support.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/onboarding">Find a new group</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.length ? (
          groups.map((g: any) => (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {g.subject} · {g.pace}
                </CardTitle>
                <CardDescription>
                  Level: {g.level} · TZ: {g.timezone}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={`/groups/${g.id}`}>Open chat</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle>No groups yet</CardTitle>
              <CardDescription>Choose group mode in onboarding to get matched automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/onboarding">Start onboarding</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

