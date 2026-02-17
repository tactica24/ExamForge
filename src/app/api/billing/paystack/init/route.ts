import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { paystackInitialize } from "@/lib/billing/paystack";
import { getServerEnv } from "@/lib/env";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:billing:init", request),
    windowMs: 10 * 60 * 1000,
    max: 20
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many billing attempts. Please wait and retry." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const env = getServerEnv();
  const email = user.email ?? "";
  if (!email) return NextResponse.json({ ok: false, message: "Email is required for billing." }, { status: 400 });

  const callbackUrl = env.PAYSTACK_CALLBACK_URL ?? `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing/callback`;

  const init = await paystackInitialize({
    email,
    amountKobo: 300000, // NGN 3,000 (adjust per tier/plan)
    callbackUrl,
    metadata: {
      user_id: user.id,
      tier: "pro"
    }
  });

  return NextResponse.json({ ok: true, url: init.authorization_url, reference: init.reference });
}
