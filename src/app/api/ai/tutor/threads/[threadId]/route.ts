import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { hasTrustedOrigin } from "@/lib/security/request";

export async function GET(req: Request, props: { params: Promise<{ threadId: string }> }) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const { threadId } = await props.params;
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const { data: thread } = await backend
    .from("tutor_threads")
    .select("id,user_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread || thread.user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "Thread not found." }, { status: 404 });
  }

  const { data: messages } = await backend
    .from("tutor_messages")
    .select("id,role,content,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ok: true, messages: messages ?? [] });
}

