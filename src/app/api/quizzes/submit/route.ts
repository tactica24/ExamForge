import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { submitQuiz } from "@/lib/quizzes/submit";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:quizzes:submit", req),
    windowMs: 10 * 60 * 1000,
    max: 80
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many submit attempts. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const quizId = String(body?.quizId ?? body?.quiz_id ?? "");
  const answers = Array.isArray(body?.answers) ? body.answers : [];

  const res = await submitQuiz({ userId: user.id, quizId, answers });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}

