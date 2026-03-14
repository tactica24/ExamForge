import { randomUUID } from "node:crypto";
import { getAwsBackendConfig } from "@/lib/aws/config";

type CognitoHostedUiState = {
  nonce: string;
  redirectTo: string;
  issuedAt: string;
};

function cleanRedirectTarget(value: string | undefined | null) {
  const candidate = String(value ?? "").trim();
  if (!candidate.startsWith("/")) return "/onboarding";
  if (candidate.startsWith("//")) return "/onboarding";
  return candidate;
}

export function encodeCognitoHostedUiState(state: CognitoHostedUiState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeCognitoHostedUiState(raw: string | undefined | null) {
  try {
    const parsed = JSON.parse(Buffer.from(String(raw ?? ""), "base64url").toString("utf8")) as Partial<CognitoHostedUiState>;
    return {
      nonce: String(parsed.nonce ?? "").trim(),
      redirectTo: cleanRedirectTarget(parsed.redirectTo),
      issuedAt: String(parsed.issuedAt ?? "").trim()
    };
  } catch {
    return null;
  }
}

export function buildCognitoHostedUiAuthorizeUrl(args?: {
  redirectTo?: string | null;
  provider?: "Google" | null;
}) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoDomain || !cfg.cognitoAppClientId || !cfg.cognitoCallbackUrl) {
    throw new Error("Cognito hosted UI is not configured.");
  }

  const state = encodeCognitoHostedUiState({
    nonce: randomUUID(),
    redirectTo: cleanRedirectTarget(args?.redirectTo),
    issuedAt: new Date().toISOString()
  });

  const url = new URL(`https://${cfg.cognitoDomain}/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.cognitoAppClientId);
  url.searchParams.set("redirect_uri", cfg.cognitoCallbackUrl);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);

  if (args?.provider === "Google") {
    url.searchParams.set("identity_provider", cfg.cognitoGoogleIdpName ?? "Google");
  }

  return {
    state,
    url: url.toString()
  };
}
