import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:parent-links:revoke", request),
    windowMs: 10 * 60 * 1000,
    max: 30
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many revoke attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, message: "Token is required." }, { status: 400 });
  }

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const result = await backend
    .from("parent_links")
    .update({ revoked_at: nowIso })
    .eq("token", token)
    .eq("user_id", user.id)
    .eq("revoked_at", null);

  if (result.error) {
    return NextResponse.json({ ok: false, message: result.error.message }, { status: 500 });
  }

  const updatedRows = Array.isArray(result.data) ? result.data.length : 0;
  if (updatedRows === 0) {
    return NextResponse.json({ ok: false, message: "Link not found or already revoked." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, token });
}


