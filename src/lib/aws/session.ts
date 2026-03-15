import { createHmac, timingSafeEqual } from "node:crypto";
import { refreshCognitoTokens, type CognitoIdTokenClaims, type CognitoTokenSet, verifyCognitoIdToken } from "@/lib/aws/cognito-public";
import { getAwsBackendConfig } from "@/lib/aws/config";
import { APP_SESSION_COOKIE } from "@/lib/backend/constants";

type CookieSetter = { set: (name: string, value: string, options: Record<string, unknown>) => unknown };
type CookieDeleter = { delete: (name: string) => unknown };

export type AwsSessionState = {
  accessToken: string | null;
  email: string | null;
  expiresAt: string;
  idToken: string;
  phone: string | null;
  refreshToken: string | null;
  role: string | null;
  subject: string;
  userMetadata: Record<string, unknown>;
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cookieOptions(maxAgeSeconds: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
    priority: "high" as const
  };
}

function signPayload(value: string) {
  const cfg = getAwsBackendConfig();
  if (!cfg.appSessionSecret) {
    throw new Error("APP_SESSION_SECRET is required for AWS sessions.");
  }
  return createHmac("sha256", cfg.appSessionSecret).update(value).digest("base64url");
}

function serializeState(state: AwsSessionState) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function parseSignedState(value: string) {
  const [payload, signature] = String(value ?? "").split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const actual = Buffer.from(signature, "utf8");
  const known = Buffer.from(expected, "utf8");
  if (actual.length !== known.length || !timingSafeEqual(actual, known)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AwsSessionState;
  } catch {
    return null;
  }
}

function getRoleFromClaims(claims: CognitoIdTokenClaims) {
  const fromCustom = cleanText(claims["custom:role"]);
  if (fromCustom) return fromCustom;

  const groups = claims["cognito:groups"];
  if (Array.isArray(groups) && groups.some((entry) => String(entry).toLowerCase() === "admin")) {
    return "admin";
  }
  if (typeof groups === "string" && groups.toLowerCase().includes("admin")) {
    return "admin";
  }

  return null;
}

function toUserMetadata(claims: CognitoIdTokenClaims) {
  const examInterestsRaw = cleanText(claims["custom:exam_interests"]);
  return {
    email_verified: Boolean(claims.email_verified),
    name: cleanText(claims.name),
    first_name: cleanText(claims.given_name),
    surname: cleanText(claims.family_name),
    phone: cleanText(claims.phone_number),
    location: cleanText(claims["custom:location"]),
    exam_interests: examInterestsRaw ? examInterestsRaw.split(",").map((item) => item.trim()).filter(Boolean) : []
  };
}

async function buildStateFromTokens(tokens: CognitoTokenSet, roleOverride?: string | null) {
  const claims = await verifyCognitoIdToken(tokens.idToken);
  return {
    accessToken: tokens.accessToken,
    email: cleanText(claims.email),
    expiresAt: new Date((claims.exp ?? 0) * 1000).toISOString(),
    idToken: tokens.idToken,
    phone: cleanText(claims.phone_number),
    refreshToken: tokens.refreshToken,
    role: roleOverride ?? getRoleFromClaims(claims),
    subject: claims.sub,
    userMetadata: toUserMetadata(claims)
  } satisfies AwsSessionState;
}

export async function setAwsSessionCookie(
  store: CookieSetter,
  args: {
    tokens: CognitoTokenSet;
    role?: string | null;
  }
) {
  const state = await buildStateFromTokens(args.tokens, args.role);
  const expiresAtMs = new Date(state.expiresAt).getTime();
  const maxAgeSeconds = Math.max(60, Math.floor((expiresAtMs - Date.now()) / 1000));
  store.set(APP_SESSION_COOKIE, serializeState(state), cookieOptions(maxAgeSeconds));
  return state;
}

export function clearAwsSessionCookie(store: CookieDeleter) {
  store.delete(APP_SESSION_COOKIE);
}

export async function readAwsSessionState(
  sessionCookie: string,
  options?: {
    cookieStore?: CookieSetter;
    role?: string | null;
  }
) {
  const parsed = parseSignedState(sessionCookie);
  if (!parsed) return null;

  const expiresAtMs = new Date(parsed.expiresAt).getTime();
  const needsRefresh = Number.isFinite(expiresAtMs) ? expiresAtMs - Date.now() < 60_000 : true;

  if (needsRefresh && parsed.refreshToken) {
    try {
      const refreshed = await refreshCognitoTokens(parsed.refreshToken);
      return await setAwsSessionCookie(options?.cookieStore ?? { set() {} }, {
        tokens: {
          ...refreshed,
          refreshToken: refreshed.refreshToken ?? parsed.refreshToken
        },
        role: options?.role ?? parsed.role
      });
    } catch {
      return null;
    }
  }

  try {
    await verifyCognitoIdToken(parsed.idToken);
  } catch {
    // If token verification fails (e.g., transient JWKS fetch), keep the session to avoid login loops.
    return parsed;
  }

  if (options?.role && options.role !== parsed.role && options.cookieStore) {
    const next = { ...parsed, role: options.role };
    const expiresAtMs2 = new Date(next.expiresAt).getTime();
    const maxAgeSeconds = Math.max(60, Math.floor((expiresAtMs2 - Date.now()) / 1000));
    options.cookieStore.set(APP_SESSION_COOKIE, serializeState(next), cookieOptions(maxAgeSeconds));
    return next;
  }

  return parsed;
}

export function stateToSessionUser(state: AwsSessionState, roleOverride?: string | null) {
  return {
    id: state.subject,
    email: state.email,
    phone: state.phone,
    app_metadata: {
      role: roleOverride ?? state.role ?? null
    },
    user_metadata: {
      ...state.userMetadata
    }
  };
}
