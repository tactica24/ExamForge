import Link from "next/link";
import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { leaveGroupAction } from "@/app/(app)/groups/actions";
import { describePace } from "@/lib/plans/pace";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export default async function GroupsPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await firebase.from("group_members").select("group_id,groups(*)").eq("user_id", user.id);

  const groups = memberships?.map((m: any) => m.groups).filter(Boolean) ?? [];

  const uniqueGroupIds = Array.from(
    new Set(groups.map((group: any) => String(group?.id ?? "").trim()).filter(Boolean))
  );

  const groupMemberCounts = new Map<string, number>(uniqueGroupIds.map((id) => [id, 0]));
  for (const batch of chunk(uniqueGroupIds, 30)) {
    const { data: members } = await firebase.from("group_members").select("group_id").in("group_id", batch);
    for (const member of members ?? []) {
      const groupId = String((member as any).group_id ?? "").trim();
      if (!groupId) continue;
      groupMemberCounts.set(groupId, (groupMemberCounts.get(groupId) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Collaborative mode: auto-matched subject groups with up to 15 learners each.
          </p>
        </div>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/settings">Manage subjects</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.length ? (
          groups.map((g: any) => (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {g.name ?? g.subject} | {describePace(g.pace)}
                </CardTitle>
                <CardDescription>
                  Level: {g.level} | TZ: {g.timezone} | {groupMemberCounts.get(g.id) ?? 0}/15 members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Button asChild className="w-full">
                    <Link href={`/groups/${g.id}`}>Open chat</Link>
                  </Button>
                  <AuthFormState action={leaveGroupAction}>
                    <input type="hidden" name="group_id" value={g.id} />
                    <SubmitButton type="submit" pendingText="Leaving..." variant="secondary" className="w-full">
                      Leave group
                    </SubmitButton>
                  </AuthFormState>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2">
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
