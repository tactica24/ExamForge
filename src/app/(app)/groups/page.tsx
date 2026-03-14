import Link from "next/link";
import { redirect } from "next/navigation";
import { createBackendServerClient } from "@/lib/backend/server";
import { withGroupMessageAuthors } from "@/lib/groups/messages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { leaveGroupAction } from "@/app/(app)/groups/actions";
import { describePace } from "@/lib/plans/pace";
import { GroupChat } from "@/components/groups/group-chat";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function groupLabel(group: any) {
  const name = String(group?.name ?? "").trim();
  if (name) return name;

  const subject = String(group?.subject ?? "").trim();
  return subject ? `${subject} Group` : "Subject Group";
}

export default async function GroupsPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const requestedGroupId = readSearchParam(searchParams.group);

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await backend.from("group_members").select("group_id,groups(*)").eq("user_id", user.id);

  const groupsById = new Map<string, any>();
  for (const membership of memberships ?? []) {
    const group = (membership as any).groups;
    const groupId = String(group?.id ?? "").trim();
    if (!groupId || groupsById.has(groupId)) continue;
    groupsById.set(groupId, group);
  }

  const groups = Array.from(groupsById.values()).sort((left: any, right: any) => {
    const leftTime = new Date(String(left?.created_at ?? 0)).getTime();
    const rightTime = new Date(String(right?.created_at ?? 0)).getTime();
    return rightTime - leftTime;
  });

  const uniqueGroupIds = Array.from(
    new Set(groups.map((group: any) => String(group?.id ?? "").trim()).filter(Boolean))
  );

  const groupMemberCounts = new Map<string, number>(uniqueGroupIds.map((id) => [id, 0]));
  for (const batch of chunk(uniqueGroupIds, 30)) {
    const { data: members } = await backend.from("group_members").select("group_id").in("group_id", batch);
    for (const member of members ?? []) {
      const groupId = String((member as any).group_id ?? "").trim();
      if (!groupId) continue;
      groupMemberCounts.set(groupId, (groupMemberCounts.get(groupId) ?? 0) + 1);
    }
  }

  const selectedGroup = groups.find((group: any) => String(group?.id ?? "") === requestedGroupId) ?? groups[0] ?? null;
  const selectedGroupId = String(selectedGroup?.id ?? "").trim();

  const selectedGroupMessages = selectedGroupId
    ? await backend
        .from("group_messages")
        .select("id,user_id,content,flagged,is_system,created_at")
        .eq("group_id", selectedGroupId)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as any[] };

  const initialMessages = await withGroupMessageAuthors({
    backend,
    messages: (selectedGroupMessages.data ?? []) as Array<{
      id: string;
      user_id: string | null;
      content: string;
      flagged: boolean;
      is_system?: boolean;
      created_at: string;
    }>
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Subject groups are assigned automatically from your exam setup. Leaving removes the group from your
            dashboard without deleting it for everyone else.
          </p>
        </div>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/settings">Manage subjects</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Subject groups</CardTitle>
            <CardDescription>Each subject keeps its own chat lane, with up to 15 learners per group.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {groups.length ? (
              <div className="divide-y">
                {groups.map((group: any) => {
                  const groupId = String(group?.id ?? "").trim();
                  const active = groupId === selectedGroupId;

                  return (
                    <Link
                      key={groupId}
                      href={`/groups?group=${groupId}`}
                      className={[
                        "block px-4 py-4 transition-colors",
                        active ? "bg-primary/10" : "hover:bg-muted/50"
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{groupLabel(group)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {group.subject} | {describePace(group.pace)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <div>{groupMemberCounts.get(groupId) ?? 0}/15</div>
                          <div>{group.level}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                No groups yet. Choose group mode in onboarding or add subjects in settings to get matched.
              </div>
            )}
          </CardContent>
        </Card>

        {selectedGroup ? (
          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">{groupLabel(selectedGroup)}</CardTitle>
                <CardDescription>
                  {describePace(selectedGroup.pace)} | {selectedGroup.level} | {selectedGroup.timezone} |{" "}
                  {groupMemberCounts.get(selectedGroupId) ?? 0}/15 members
                </CardDescription>
              </div>
              <AuthFormState action={leaveGroupAction}>
                <input type="hidden" name="group_id" value={selectedGroupId} />
                <SubmitButton type="submit" pendingText="Leaving..." variant="secondary">
                  Leave group
                </SubmitButton>
              </AuthFormState>
            </CardHeader>
            <CardContent>
              <GroupChat groupId={selectedGroupId} currentUserId={user.id} initialMessages={initialMessages} />
            </CardContent>
          </Card>
        ) : (
          <Card>
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

