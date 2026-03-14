import { NextResponse } from "next/server";
import { buildCognitoHostedUiAuthorizeUrl } from "@/lib/aws/cognito-hosted-ui";

function cleanRedirectTarget(value: string | null) {
  const candidate = String(value ?? "").trim();
  if (!candidate.startsWith("/")) return "/onboarding";
  if (candidate.startsWith("//")) return "/onboarding";
  return candidate;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const redirectTo = cleanRedirectTarget(searchParams.get("redirectTo"));

  try {
    const { url } = buildCognitoHostedUiAuthorizeUrl({
      redirectTo,
      provider: provider?.toLowerCase() === "google" ? "Google" : null
    });
    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Google sign-in.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url), { status: 302 });
  }
}
