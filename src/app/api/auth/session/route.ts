import { NextResponse } from "next/server";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:auth:session", req),
    windowMs: 10 * 60 * 1000,
    max: 30
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many session attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const body = await req.json().catch(() => null);
  const idToken = String(body?.idToken ?? "").trim();

  if (!idToken) {
    return NextResponse.json({ ok: false, message: "idToken is required." }, { status: 400 });
  }

  return NextResponse.json(
    {
      ok: false,
      message:
        "Direct token session creation is not used in the AWS auth flow. Start sign-in through /api/auth/cognito/start."
    },
    { status: 400 }
  );
}
