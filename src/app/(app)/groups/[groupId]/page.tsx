import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupChat } from "@/components/groups/group-chat";

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
          <CardTitle className="text-base">{group.subject}</CardTitle>
          <CardDescription>
            {group.pace} · {group.level} · {group.timezone}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GroupChat groupId={groupId} currentUserId={user.id} initialMessages={messages ?? []} />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Chats are moderated. Report issues via admin tools (placeholder).
      </p>
    </div>
  );
}
