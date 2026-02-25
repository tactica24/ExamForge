import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { submitQuiz } from "@/lib/quizzes/submit";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:quizzes:sync", req),
    windowMs: 10 * 60 * 1000,
    max: 40
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many sync attempts. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

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
