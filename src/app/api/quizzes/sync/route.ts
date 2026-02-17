import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { submitQuiz } from "@/lib/quizzes/submit";

export async function POST(req: Request) {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items: Array<{ quizId: string; answers: number[] }> = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ ok: true, synced: 0 });

  let synced = 0;
  const results: any[] = [];

  for (const it of items.slice(0, 50)) {
    const res = await submitQuiz({ userId: user.id, quizId: String(it.quizId), answers: Array.isArray(it.answers) ? it.answers : [] });
    if (res.ok) synced += 1;
    results.push({ quizId: it.quizId, ok: res.ok, duplicate: (res as any).duplicate ?? false });
  }

  return NextResponse.json({ ok: true, synced, results });
}
