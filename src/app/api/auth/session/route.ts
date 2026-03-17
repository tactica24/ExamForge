import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-app";
import { establishTrackedSessionFromIdToken } from "@/lib/firebase/server";
import { getServerEnv } from "@/lib/env";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

async function lookupUserWithIdentityToolkit(idToken: string) {
  const env = getServerEnv();
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Firebase web API key is missing.");
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(payload?.error?.message ?? "Unable to validate Google sign-in."));
  }

  const user = Array.isArray(payload?.users) ? payload.users[0] : null;
  const uid = String(user?.localId ?? "").trim();
  if (!uid) {
    throw new Error("Google sign-in did not return a valid account.");
  }

  return {
    uid,
    email: user?.email ? String(user.email) : null,
    emailVerified: Boolean(user?.emailVerified)
  };
}

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

  try {
    const auth = getFirebaseAdminAuth();
    const verifiedUser = auth
      ? await auth
          .verifyIdToken(idToken, true)
          .then((decoded) => ({
            uid: decoded.uid,
            email: decoded.email ?? null,
            emailVerified: decoded.email_verified !== false
          }))
      : await lookupUserWithIdentityToolkit(idToken);

    if (verifiedUser.email && verifiedUser.emailVerified === false) {
      return NextResponse.json(
        { ok: false, message: "Verify your email before continuing." },
        { status: 403 }
      );
    }

    const established = await establishTrackedSessionFromIdToken({
      idToken,
      userId: verifiedUser.uid,
      email: verifiedUser.email
    });

    if (!established.ok) {
      return NextResponse.json({ ok: false, message: established.message }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create session.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
