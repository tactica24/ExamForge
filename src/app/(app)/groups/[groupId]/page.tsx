import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupChat } from "@/components/groups/group-chat";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leaveGroupAction, renameGroupAction } from "@/app/(app)/groups/actions";

export default async function GroupPage(props: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await props.params;
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await firebase.from("groups").select("*").eq("id", groupId).maybeSingle();
  if (!group) redirect("/groups");

  const { data: membership } = await firebase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/groups");

  const { data: messages } = await firebase
    .from("group_messages")
    .select("id,user_id,content,flagged,is_system,created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{group.name ?? group.subject}</CardTitle>
          <CardDescription>
            {group.pace} · {group.level} · {group.timezone}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GroupChat groupId={groupId} currentUserId={user.id} initialMessages={messages ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Group settings</CardTitle>
          <CardDescription>Rename this group or leave it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthFormState action={renameGroupAction}>
            <input type="hidden" name="group_id" value={groupId} />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="name">Group name</Label>
                <Input id="name" name="name" defaultValue={group.name ?? `${group.subject} group`} required />
              </div>
              <SubmitButton type="submit" pendingText="Saving..." className="self-end">
                Save
              </SubmitButton>
            </div>
          </AuthFormState>

          <AuthFormState action={leaveGroupAction}>
            <input type="hidden" name="group_id" value={groupId} />
            <SubmitButton type="submit" pendingText="Leaving..." variant="secondary">
              Leave group
            </SubmitButton>
          </AuthFormState>
        </CardContent>
      </Card>
    </div>
  );
}
