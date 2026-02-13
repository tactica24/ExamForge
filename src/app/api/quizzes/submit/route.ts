import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitQuiz } from "@/lib/quizzes/submit";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const quizId = String(body?.quizId ?? body?.quiz_id ?? "");
  const answers = Array.isArray(body?.answers) ? body.answers : [];

  const res = await submitQuiz({ userId: user.id, quizId, answers });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
