import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { hasTrustedOrigin } from "@/lib/security/request";

export async function GET(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const url = new URL(req.url);
  const examId = String(url.searchParams.get("exam_id") ?? "").trim();
  const subject = String(url.searchParams.get("subject") ?? "").trim();

  let query = firebase
    .from("tutor_threads")
    .select("id,title,exam_id,exam,subject,created_at,updated_at,last_message_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (examId) query = query.eq("exam_id", examId) as any;
  if (subject) query = query.eq("subject", subject) as any;

  const { data, error } = await (query as any);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, threads: data ?? [] });
}
