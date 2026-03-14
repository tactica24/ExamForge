import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { withGroupMessageAuthors } from "@/lib/groups/messages";

export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const { searchParams } = new URL(request.url);
  const after = String(searchParams.get("after") ?? "").trim();

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });
  }

  const { data: membership } = await backend
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ ok: false, message: "Group access denied." }, { status: 403 });
  }

  let query = backend
    .from("group_messages")
    .select("id,user_id,content,flagged,is_system,created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (after) {
    query = query.gte("created_at", after);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const messages = await withGroupMessageAuthors({
    backend,
    messages: (data ?? []) as Array<{
      id: string;
      user_id: string | null;
      content: string;
      flagged: boolean;
      is_system?: boolean;
      created_at: string;
    }>
  });

  return NextResponse.json({ ok: true, messages });
}
