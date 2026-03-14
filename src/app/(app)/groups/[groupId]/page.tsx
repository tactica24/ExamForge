import { redirect } from "next/navigation";
import { createBackendServerClient } from "@/lib/backend/server";

export default async function GroupPage(props: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await props.params;
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) redirect("/login");

  redirect(`/groups?group=${encodeURIComponent(groupId)}`);
}
