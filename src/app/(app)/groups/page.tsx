import Link from "next/link";
import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { GroupChat } from "@/components/groups/group-chat";
import { leaveGroupAction } from "@/app/(app)/groups/actions";
import { describePace } from "@/lib/plans/pace";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function looksLikeInternalPrompt(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (text.length > 90) return true;
  return /system instructions|return valid json|topic lesson json|^you are\b|```|create .*diagram|generate .*json/i.test(text);
}

function getGroupDisplayName(group: any) {
  const subject = String(group?.subject ?? "Subject").trim() || "Subject";
  const fallback = `${subject} group`;
  const rawName = String(group?.name ?? "").trim();
  if (!rawName || looksLikeInternalPrompt(rawName)) return fallback;
  return rawName;
}

export default async function GroupsPage(props: { searchParams: Promise<{ group?: string }> }) {
  const searchParams = await props.searchParams;
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await firebase
    .from("group_members")
    .select("group_id,groups(*)")
    .eq("user_id", user.id);

  const groups = memberships?.map((membership: any) => membership.groups).filter(Boolean) ?? [];
  const sortedGroups = [...groups].sort((left: any, right: any) => {
    const leftTime = new Date(String(left?.created_at ?? 0)).getTime();
    const rightTime = new Date(String(right?.created_at ?? 0)).getTime();
    return rightTime - leftTime;
  });

  const uniqueGroupIds = Array.from(
    new Set(sortedGroups.map((group: any) => String(group?.id ?? "").trim()).filter(Boolean))
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

  const selectedGroupId =
    uniqueGroupIds.find((groupId) => groupId === String(searchParams.group ?? "").trim()) ?? uniqueGroupIds[0] ?? null;
  const selectedGroup = sortedGroups.find((group: any) => String(group?.id ?? "").trim() === selectedGroupId) ?? null;

  let selectedMessages: Array<Record<string, unknown>> = [];
  if (selectedGroupId) {
    const { data: messages } = await firebase
      .from("group_messages")
      .select("id,user_id,content,flagged,is_system,created_at")
      .eq("group_id", selectedGroupId)
      .order("created_at", { ascending: false })
      .limit(80);

    const authorIds = Array.from(
      new Set((messages ?? []).map((message: any) => String(message?.user_id ?? "").trim()).filter(Boolean))
    );
    const authorNameById = new Map<string, string>();

    for (const batch of chunk(authorIds, 30)) {
      const { data: profiles } = await firebase
        .from("profiles")
        .select("user_id,display_name,name")
        .in("user_id", batch);

      for (const profile of profiles ?? []) {
        const userId = String((profile as any)?.user_id ?? "").trim();
        const authorName = String((profile as any)?.display_name ?? (profile as any)?.name ?? "").trim();
        if (userId) authorNameById.set(userId, authorName || "Member");
      }
    }

    selectedMessages = (messages ?? []).map((message: any) => ({
      ...message,
      author_name: message.user_id ? authorNameById.get(String(message.user_id)) ?? "Member" : "ACE NAIJA"
    }));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Subject rooms are created automatically.
          </p>
        </div>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/settings">Manage subjects</Link>
        </Button>
      </div>

      {sortedGroups.length ? (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="overflow-hidden xl:h-[76vh]">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-base">Your subject groups</CardTitle>
              <CardDescription>Switch chats from the left and keep each subject in its own room.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {sortedGroups.map((group: any) => {
                  const groupId = String(group?.id ?? "");
                  const isActive = groupId === selectedGroupId;

                  return (
                    <Link
                      key={groupId}
                      href={`/groups?group=${encodeURIComponent(groupId)}`}
                      className={[
                        "block px-4 py-4 transition-colors hover:bg-muted/30",
                        isActive ? "bg-primary/10" : ""
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{getGroupDisplayName(group)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {group.subject} • {describePace(group.pace)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {group.level} • {groupMemberCounts.get(groupId) ?? 0}/15 members
                          </div>
                        </div>
                        {isActive ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedGroup ? (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <CardTitle className="text-base">{getGroupDisplayName(selectedGroup)}</CardTitle>
                      <CardDescription>
                        {selectedGroup.subject} • {describePace(selectedGroup.pace)} • {selectedGroup.level} •{" "}
                        {groupMemberCounts.get(String(selectedGroup.id)) ?? 0}/15 members
                      </CardDescription>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/settings">Add more subjects</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <GroupChat
                    groupId={String(selectedGroup.id)}
                    currentUserId={user.id}
                    initialMessages={selectedMessages as any}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Group options</CardTitle>
                </CardHeader>
                <CardContent>
                  <AuthFormState action={leaveGroupAction}>
                    <input type="hidden" name="group_id" value={selectedGroup.id} />
                    <SubmitButton type="submit" pendingText="Leaving..." variant="secondary">
                      Exit group
                    </SubmitButton>
                  </AuthFormState>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No groups yet</CardTitle>
            <CardDescription>
              Add another subject in settings or switch one of your subjects to group mode to get matched automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings">Open settings</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
