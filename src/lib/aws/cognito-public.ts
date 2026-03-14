import { createPublicKey, createHmac, verify } from "node:crypto";
import { getAwsBackendConfig } from "@/lib/aws/config";

type CognitoJson = Record<string, unknown>;

export type CognitoTokenSet = {
  accessToken: string | null;
  idToken: string;
  refreshToken: string | null;
  expiresIn: number;
  tokenType: string | null;
};

export type CognitoIdTokenClaims = Record<string, unknown> & {
  aud?: string;
  client_id?: string;
  email?: string;
  email_verified?: boolean;
  exp?: number;
  family_name?: string;
  given_name?: string;
  iat?: number;
  iss?: string;
  name?: string;
  phone_number?: string;
  sub: string;
  token_use?: string;
  "cognito:groups"?: string[] | string;
  "cognito:username"?: string;
  "custom:role"?: string;
};

type JsonWebKeyShape = {
  alg?: string;
  e?: string;
  kid?: string;
  kty?: string;
  n?: string;
  use?: string;
};

let jwksCache:
  | {
      fetchedAt: number;
      keys: JsonWebKeyShape[];
    }
  | null = null;

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeCognitoError(json: CognitoJson | null) {
  const type = String(json?.__type ?? json?.code ?? "").split("#").pop() ?? "";
  const message = String((json?.message ?? json?.Message ?? type) || "Authentication failed.");

  if (type === "NotAuthorizedException") {
    return "Invalid email or password.";
  }
  if (type === "UserNotConfirmedException") {
    return "Check your email for the confirmation code and verify your account before logging in.";
  }
  if (type === "UsernameExistsException") {
    return "An account with this email already exists.";
  }
  if (type === "InvalidPasswordException") {
    return message;
  }
  if (type === "CodeMismatchException") {
    return "The confirmation code is invalid.";
  }
  if (type === "ExpiredCodeException") {
    return "The confirmation code has expired. Request a new one and try again.";
  }
  if (type === "TooManyRequestsException") {
    return "Too many attempts. Try again later.";
  }
  return message;
}

function getCognitoBaseUrl() {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoRegion) {
    throw new Error("COGNITO_REGION is required for AWS auth.");
  }
  return `https://cognito-idp.${cfg.cognitoRegion}.amazonaws.com/`;
}

function getClientSecretHash(username: string) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoAppClientSecret || !cfg.cognitoAppClientId) return null;

  return createHmac("sha256", cfg.cognitoAppClientSecret)
    .update(`${username}${cfg.cognitoAppClientId}`)
    .digest("base64");
}

function base64UrlToBuffer(value: string) {
  return Buffer.from(value, "base64url");
}

function decodeJwtPart<T>(value: string) {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as T;
}

function toTokenSet(json: CognitoJson): CognitoTokenSet {
  const idToken = cleanText(json.id_token ?? json.IdToken);
  if (!idToken) {
    throw new Error("Cognito did not return an ID token.");
  }

  return {
    accessToken: cleanText(json.access_token ?? json.AccessToken),
    idToken,
    refreshToken: cleanText(json.refresh_token ?? json.RefreshToken),
    expiresIn: Math.max(60, Number(json.expires_in ?? json.ExpiresIn ?? 3600)),
    tokenType: cleanText(json.token_type ?? json.TokenType)
  };
}

async function callCognitoJsonRpc(target: string, body: CognitoJson) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoAppClientId) {
    throw new Error("COGNITO_APP_CLIENT_ID is required for AWS auth.");
  }

  const res = await fetch(getCognitoBaseUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const json = (await res.json().catch(() => null)) as CognitoJson | null;
  if (!res.ok) {
    throw new Error(normalizeCognitoError(json));
  }

  return json ?? {};
}

async function callCognitoTokenEndpoint(params: URLSearchParams) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoDomain || !cfg.cognitoAppClientId || !cfg.cognitoCallbackUrl) {
    throw new Error("Cognito hosted UI is not configured.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded"
  };

  if (cfg.cognitoAppClientSecret) {
    headers.Authorization = `Basic ${Buffer.from(
      `${cfg.cognitoAppClientId}:${cfg.cognitoAppClientSecret}`,
      "utf8"
    ).toString("base64")}`;
  }

  const res = await fetch(`https://${cfg.cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers,
    body: params.toString(),
    cache: "no-store"
  });

  const json = (await res.json().catch(() => null)) as CognitoJson | null;
  if (!res.ok) {
    throw new Error(normalizeCognitoError(json));
  }

  return json ?? {};
}

async function getJwks() {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoRegion || !cfg.cognitoUserPoolId) {
    throw new Error("COGNITO_REGION and COGNITO_USER_POOL_ID are required.");
  }

  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < 1000 * 60 * 10) {
    return jwksCache.keys;
  }

  const res = await fetch(
    `https://cognito-idp.${cfg.cognitoRegion}.amazonaws.com/${cfg.cognitoUserPoolId}/.well-known/jwks.json`,
    { cache: "no-store" }
  );
  const json = (await res.json().catch(() => null)) as { keys?: JsonWebKeyShape[] } | null;
  const keys = Array.isArray(json?.keys) ? json.keys : [];
  if (!keys.length) {
    throw new Error("Unable to load Cognito signing keys.");
  }

  jwksCache = { fetchedAt: now, keys };
  return keys;
}

export async function signInWithCognitoPassword(args: { email: string; password: string }) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoAppClientId) {
    throw new Error("COGNITO_APP_CLIENT_ID is required for AWS auth.");
  }

  const secretHash = getClientSecretHash(args.email);
  const json = await callCognitoJsonRpc("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: cfg.cognitoAppClientId,
    AuthParameters: {
      USERNAME: args.email,
      PASSWORD: args.password,
      ...(secretHash ? { SECRET_HASH: secretHash } : {})
    }
  });

  return toTokenSet((json.AuthenticationResult as CognitoJson | undefined) ?? {});
}

export async function signUpWithCognito(args: {
  email: string;
  password: string;
  attributes?: Record<string, string | null | undefined>;
}) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoAppClientId) {
    throw new Error("COGNITO_APP_CLIENT_ID is required for AWS auth.");
  }

  const secretHash = getClientSecretHash(args.email);
  const userAttributes = Object.entries({
    email: args.email,
    ...(args.attributes ?? {})
  })
    .map(([Name, Value]) => ({ Name, Value: cleanText(Value) }))
    .filter((entry): entry is { Name: string; Value: string } => Boolean(entry.Value));

  const json = await callCognitoJsonRpc("SignUp", {
    ClientId: cfg.cognitoAppClientId,
    Username: args.email,
    Password: args.password,
    UserAttributes: userAttributes,
    ...(secretHash ? { SecretHash: secretHash } : {})
  });

  return {
    userId: cleanText(json.UserSub),
    userConfirmed: Boolean(json.UserConfirmed)
  };
}

export async function confirmCognitoSignUp(args: { email: string; code: string }) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoAppClientId) {
    throw new Error("COGNITO_APP_CLIENT_ID is required for AWS auth.");
  }

  const secretHash = getClientSecretHash(args.email);
  await callCognitoJsonRpc("ConfirmSignUp", {
    ClientId: cfg.cognitoAppClientId,
    Username: args.email,
    ConfirmationCode: args.code,
    ...(secretHash ? { SecretHash: secretHash } : {})
  });
}

export async function resendCognitoConfirmationCode(args: { email: string }) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoAppClientId) {
    throw new Error("COGNITO_APP_CLIENT_ID is required for AWS auth.");
  }

  const secretHash = getClientSecretHash(args.email);
  await callCognitoJsonRpc("ResendConfirmationCode", {
    ClientId: cfg.cognitoAppClientId,
    Username: args.email,
    ...(secretHash ? { SecretHash: secretHash } : {})
  });
}

export async function exchangeCognitoAuthCode(code: string) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoAppClientId || !cfg.cognitoCallbackUrl) {
    throw new Error("Cognito hosted UI is not configured.");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.cognitoAppClientId,
    code,
    redirect_uri: cfg.cognitoCallbackUrl
  });

  const json = await callCognitoTokenEndpoint(params);
  return toTokenSet(json);
}

export async function refreshCognitoTokens(refreshToken: string) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoAppClientId) {
    throw new Error("Cognito app client is not configured.");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cfg.cognitoAppClientId,
    refresh_token: refreshToken
  });

  const json = await callCognitoTokenEndpoint(params);
  const tokenSet = toTokenSet(json);
  if (!tokenSet.refreshToken) {
    tokenSet.refreshToken = refreshToken;
  }
  return tokenSet;
}

export async function verifyCognitoIdToken(idToken: string) {
  const cfg = getAwsBackendConfig();
  if (!cfg.cognitoRegion || !cfg.cognitoUserPoolId || !cfg.cognitoAppClientId) {
    throw new Error("Cognito auth is not fully configured.");
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed Cognito ID token.");
  }

  const [headerRaw, payloadRaw, signatureRaw] = parts;
  const header = decodeJwtPart<{ alg?: string; kid?: string }>(headerRaw);
  const claims = decodeJwtPart<CognitoIdTokenClaims>(payloadRaw);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Cognito token header.");
  }

  const jwk = (await getJwks()).find((entry) => entry.kid === header.kid);
  if (!jwk) {
    throw new Error("Missing Cognito signing key.");
  }

  const key = createPublicKey({ key: jwk as any, format: "jwk" });
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${headerRaw}.${payloadRaw}`, "utf8"),
    key,
    base64UrlToBuffer(signatureRaw)
  );

  if (!valid) {
    throw new Error("Invalid Cognito token signature.");
  }

  const issuer = `https://cognito-idp.${cfg.cognitoRegion}.amazonaws.com/${cfg.cognitoUserPoolId}`;
  if (claims.iss !== issuer) {
    throw new Error("Invalid Cognito token issuer.");
  }
  if (claims.token_use !== "id") {
    throw new Error("Expected a Cognito ID token.");
  }
  if (claims.aud !== cfg.cognitoAppClientId) {
    throw new Error("Invalid Cognito token audience.");
  }
  if (!claims.exp || claims.exp * 1000 <= Date.now()) {
    throw new Error("Cognito session has expired.");
  }
  if (!claims.sub) {
    throw new Error("Cognito token is missing a subject.");
  }

  return claims;
}
