import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

async function performLogout(request?: Request) {
  const firebase = await createFirebaseServerClient();
  await firebase.auth.signOut();
  const target = request ? new URL("/", request.url) : new URL("/", "http://localhost");
  return NextResponse.redirect(target, {
    status: 303
  });
}

export async function GET(request: Request) {
  return performLogout(request);
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request.headers)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("route:logout", request),
    windowMs: 5 * 60 * 1000,
    max: 30
  });
  if (!rate.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSec) }
    });
  }

  return performLogout(request);
}
