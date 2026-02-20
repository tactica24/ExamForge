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

  const payload = items.slice(0, 50).map((item) => ({
    quizId: String(item.quizId),
    answers: Array.isArray(item.answers) ? item.answers : []
  }));

  const concurrency = 5;
  let synced = 0;
  const results: any[] = [];

  for (let start = 0; start < payload.length; start += concurrency) {
    const batch = payload.slice(start, start + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const res = await submitQuiz({ userId: user.id, quizId: item.quizId, answers: item.answers });
        return { quizId: item.quizId, ok: res.ok, duplicate: (res as any).duplicate ?? false };
      })
    );

    synced += batchResults.filter((entry) => entry.ok).length;
    results.push(...batchResults);
  }

  return NextResponse.json({ ok: true, synced, results });
}
