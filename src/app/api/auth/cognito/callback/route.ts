import { NextResponse } from "next/server";
import { decodeCognitoHostedUiState } from "@/lib/aws/cognito-hosted-ui";
import { exchangeCognitoAuthCode, verifyCognitoIdToken } from "@/lib/aws/cognito-public";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { establishTrackedSessionFromTokens } from "@/lib/backend/server";

function cleanRedirectTarget(value: string | null | undefined) {
  const candidate = String(value ?? "").trim();
  if (!candidate.startsWith("/")) return "/onboarding";
  if (candidate.startsWith("//")) return "/onboarding";
  return candidate;
}

async function ensureProfileForOAuthUser(idToken: string) {
  const claims = await verifyCognitoIdToken(idToken);
  const admin = createBackendAdminClient();
  const fullName = String(claims.name ?? "").trim() || null;
  const existing = await admin.from("profiles").select("user_id").eq("user_id", claims.sub).maybeSingle();
  if (existing.data) return;

  await admin.from("profiles").upsert(
    {
      user_id: claims.sub,
      email: claims.email ?? null,
      name: fullName,
      display_name: fullName,
      phone: claims.phone_number ?? null,
      subscription_tier: "free",
      learning_style: "visual",
      level: "beginner",
      timezone: "Africa/Lagos"
    },
    { onConflict: "user_id" }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authError = url.searchParams.get("error");
  const authErrorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = decodeCognitoHostedUiState(url.searchParams.get("state"));
  const redirectTo = cleanRedirectTarget(state?.redirectTo);

  if (authError) {
    const message = authErrorDescription || authError;
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url), { status: 302 });
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=Missing+authorization+code", request.url), { status: 302 });
  }

  try {
    const tokens = await exchangeCognitoAuthCode(code);
    const established = await establishTrackedSessionFromTokens({ tokens });
    if (!established.ok) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(established.message)}`, request.url),
        { status: 302 }
      );
    }

    await ensureProfileForOAuthUser(tokens.idToken).catch(() => {});
    return NextResponse.redirect(new URL(redirectTo, request.url), { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete sign-in.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url), { status: 302 });
  }
}
