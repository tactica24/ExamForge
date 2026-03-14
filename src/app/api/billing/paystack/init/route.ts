import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { PAYSTACK_PRO_MONTHLY_AMOUNT_KOBO, paystackInitialize } from "@/lib/billing/paystack";
import { getAppUrl } from "@/lib/app-url";
import { PRO_PLAN_DAYS } from "@/lib/billing/access";
import { getServerEnv } from "@/lib/env";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
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

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const env = getServerEnv();
  const email = user.email ?? "";
  if (!email) return NextResponse.json({ ok: false, message: "Email is required for billing." }, { status: 400 });

  const callbackUrl = env.PAYSTACK_CALLBACK_URL ?? `${getAppUrl()}/billing/callback`;

  try {
    const init = await paystackInitialize({
      email,
      amountKobo: PAYSTACK_PRO_MONTHLY_AMOUNT_KOBO,
      callbackUrl,
      metadata: {
        user_id: user.id,
        tier: "pro",
        duration_days: PRO_PLAN_DAYS,
        initiated_at: new Date().toISOString()
      }
    });

    return NextResponse.json({ ok: true, url: init.authorization_url, reference: init.reference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
