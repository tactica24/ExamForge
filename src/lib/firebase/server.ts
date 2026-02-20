import "server-only";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createFirebaseDataClient, type FirebaseDataClient } from "@/lib/firebase/data-client";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-app";
import {
  clearFirebaseSessionCookie,
  readFirebaseSessionUser,
  setFirebaseSessionCookie
} from "@/lib/firebase/session";
import {
  FIREBASE_DEVICE_COOKIE,
  FIREBASE_SESSION_COOKIE,
  FIREBASE_TRACKED_SESSION_COOKIE
} from "@/lib/firebase/constants";
import { getAppUrl } from "@/lib/app-url";
import { getServerEnv } from "@/lib/env";

const MAX_ACTIVE_DEVICE_SESSIONS = 3;
const AUTH_SESSION_IDLE_MS = 1000 * 60 * 60 * 24 * 30;
const TRACKED_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24;
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const LAST_SEEN_WRITE_INTERVAL_MS = 1000 * 60 * 5;
const DEVICE_LIMIT_MESSAGE =
  "Maximum active device limit reached (3 devices). Log out from another device and try again.";
const DEVICE_LIMIT_FALLBACK_ERROR =
  "Could not validate active device limit right now. Please try again in a moment.";

type AuthPayload = {
  id: string;
  email: string | null;
  phone: string | null;
};

type AuthSessionRow = {
  id: string;
  user_id: string;
  email: string | null;
  device_id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type HeaderStore = Awaited<ReturnType<typeof headers>>;

function normalizeAuthError(message: string) {
  const m = message.toUpperCase();
  if (m.includes("INVALID_LOGIN_CREDENTIALS") || m.includes("INVALID_PASSWORD") || m.includes("EMAIL_NOT_FOUND")) {
    return "Invalid login credentials.";
  }
  if (m.includes("EMAIL_EXISTS")) {
    return "An account with this email already exists.";
  }
  if (m.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
    return "Too many attempts. Try again later.";
  }
  return message;
}

function trackingCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    priority: "high" as const
  };
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function nowIso() {
  return new Date().toISOString();
}

function toMs(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function parseSessionRow(value: unknown): AuthSessionRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = cleanText(row.id, 80);
  const userId = cleanText(row.user_id, 80);
  const deviceId = cleanText(row.device_id, 120);
  if (!id || !userId || !deviceId) return null;

  return {
    id,
    user_id: userId,
    email: cleanText(row.email, 200) || null,
    device_id: deviceId,
    user_agent: cleanText(row.user_agent, 500) || null,
    ip_address: cleanText(row.ip_address, 120) || null,
    created_at: cleanText(row.created_at, 40) || nowIso(),
    last_seen_at: cleanText(row.last_seen_at, 40) || nowIso(),
    revoked_at: cleanText(row.revoked_at, 40) || null
  };
}

function isStaleSession(row: AuthSessionRow, atMs = Date.now()) {
  const lastSeen = toMs(row.last_seen_at);
  if (!lastSeen) return true;
  return atMs - lastSeen > AUTH_SESSION_IDLE_MS;
}

function shouldWriteLastSeen(row: AuthSessionRow, atMs = Date.now()) {
  const lastSeen = toMs(row.last_seen_at);
  if (!lastSeen) return true;
  return atMs - lastSeen >= LAST_SEEN_WRITE_INTERVAL_MS;
}

function requestIp(headerStore: HeaderStore) {
  const forwarded = cleanText(headerStore.get("x-forwarded-for"), 200);
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return cleanText(headerStore.get("x-real-ip"), 120) || null;
}

function clearTrackedSessionCookie(cookieStore: CookieStore) {
  try {
    cookieStore.delete(FIREBASE_TRACKED_SESSION_COOKIE);
  } catch {
    // Server Components may not allow cookie mutation.
  }
}

function clearSessionCookies(cookieStore: CookieStore) {
  try {
    clearFirebaseSessionCookie(cookieStore);
  } catch {
    // Server Components may not allow cookie mutation.
  }
  clearTrackedSessionCookie(cookieStore);
}

async function setDeviceCookie(cookieStore: CookieStore) {
  const existing = cleanText(cookieStore.get(FIREBASE_DEVICE_COOKIE)?.value, 120);
  if (existing) return existing;

  const deviceId = randomUUID();
  cookieStore.set(FIREBASE_DEVICE_COOKIE, deviceId, trackingCookieOptions(DEVICE_COOKIE_MAX_AGE));
  return deviceId;
}

function setTrackedSessionCookie(cookieStore: CookieStore, sessionId: string) {
  cookieStore.set(
    FIREBASE_TRACKED_SESSION_COOKIE,
    sessionId,
    trackingCookieOptions(TRACKED_SESSION_COOKIE_MAX_AGE)
  );
}

async function listActiveSessions(args: { dataClient: FirebaseDataClient; userId: string }) {
  const { data } = await args.dataClient
    .from("auth_sessions")
    .select("*")
    .eq("user_id", args.userId)
    .eq("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((entry) => parseSessionRow(entry)).filter(Boolean) as AuthSessionRow[];
}

async function revokeSession(args: {
  dataClient: FirebaseDataClient;
  sessionId: string;
  reason: string;
}) {
  await args.dataClient
    .from("auth_sessions")
    .update({
      revoked_at: nowIso(),
      revoked_reason: args.reason
    })
    .eq("id", args.sessionId);
}

async function pruneStaleSessions(args: { dataClient: FirebaseDataClient; sessions: AuthSessionRow[] }) {
  const active: AuthSessionRow[] = [];
  const stale: AuthSessionRow[] = [];

  for (const session of args.sessions) {
    if (isStaleSession(session)) stale.push(session);
    else active.push(session);
  }

  if (stale.length) {
    await Promise.all(
      stale.map((session) =>
        revokeSession({
          dataClient: args.dataClient,
          sessionId: session.id,
          reason: "idle_timeout"
        })
      )
    );
  }

  return active;
}

async function registerOrReuseSession(args: {
  dataClient: FirebaseDataClient;
  cookieStore: CookieStore;
  headerStore: HeaderStore;
  userId: string;
  email: string | null;
}) {
  let activeSessions = await listActiveSessions({
    dataClient: args.dataClient,
    userId: args.userId
  });
  activeSessions = await pruneStaleSessions({
    dataClient: args.dataClient,
    sessions: activeSessions
  });

  const deviceId = await setDeviceCookie(args.cookieStore);
  const userAgent = cleanText(args.headerStore.get("user-agent"), 500) || null;
  const ipAddress = requestIp(args.headerStore);
  const now = nowIso();

  const existingDeviceSession = activeSessions.find((session) => session.device_id === deviceId);
  if (existingDeviceSession) {
    await args.dataClient
      .from("auth_sessions")
      .update({
        email: args.email,
        user_agent: userAgent,
        ip_address: ipAddress,
        last_seen_at: now
      })
      .eq("id", existingDeviceSession.id);

    setTrackedSessionCookie(args.cookieStore, existingDeviceSession.id);
    return { ok: true as const };
  }

  if (activeSessions.length >= MAX_ACTIVE_DEVICE_SESSIONS) {
    return {
      ok: false as const,
      message: DEVICE_LIMIT_MESSAGE
    };
  }

  const sessionId = randomUUID();
  const { error } = await args.dataClient.from("auth_sessions").insert({
    id: sessionId,
    user_id: args.userId,
    email: args.email,
    device_id: deviceId,
    user_agent: userAgent,
    ip_address: ipAddress,
    created_at: now,
    last_seen_at: now,
    revoked_at: null
  });

  if (error) {
    return {
      ok: false as const,
      message: DEVICE_LIMIT_FALLBACK_ERROR
    };
  }

  setTrackedSessionCookie(args.cookieStore, sessionId);
  return { ok: true as const };
}

async function validateTrackedSession(args: {
  dataClient: FirebaseDataClient;
  cookieStore: CookieStore;
  headerStore: HeaderStore;
  userId: string;
}) {
  const sid = cleanText(args.cookieStore.get(FIREBASE_TRACKED_SESSION_COOKIE)?.value, 80);
  if (!sid) return true;

  const { data } = await args.dataClient.from("auth_sessions").select("*").eq("id", sid).maybeSingle();
  const session = parseSessionRow(data);
  if (!session) return false;
  if (session.user_id !== args.userId) return false;
  if (session.revoked_at) return false;

  if (isStaleSession(session)) {
    await revokeSession({
      dataClient: args.dataClient,
      sessionId: session.id,
      reason: "idle_timeout"
    });
    return false;
  }

  if (shouldWriteLastSeen(session)) {
    await args.dataClient
      .from("auth_sessions")
      .update({
        last_seen_at: nowIso(),
        user_agent: cleanText(args.headerStore.get("user-agent"), 500) || session.user_agent,
        ip_address: requestIp(args.headerStore) || session.ip_address
      })
      .eq("id", session.id);
  }

  return true;
}

async function callIdentityToolkit(endpoint: string, payload: Record<string, unknown>) {
  const env = getServerEnv();
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Firebase web API key is missing. Set NEXT_PUBLIC_FIREBASE_API_KEY.");
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = String(json?.error?.message ?? "Authentication failed");
    throw new Error(normalizeAuthError(raw));
  }

  return json as Record<string, any>;
}

function getEmailVerificationContinueUrl() {
  return `${getAppUrl()}/login?verified=1`;
}

async function lookupIdentityToolkitUser(idToken: string) {
  const json = await callIdentityToolkit("accounts:lookup", { idToken });
  const users = Array.isArray(json.users) ? json.users : [];
  return (users[0] as Record<string, unknown> | undefined) ?? null;
}

async function sendVerificationEmail(idToken: string) {
  try {
    await callIdentityToolkit("accounts:sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken,
      continueUrl: getEmailVerificationContinueUrl()
    });
  } catch (error) {
    const raw = (error instanceof Error ? error.message : "").toUpperCase();
    const invalidContinueUrl =
      raw.includes("INVALID_CONTINUE_URI") ||
      raw.includes("UNAUTHORIZED_CONTINUE_URI") ||
      raw.includes("MISSING_CONTINUE_URI");

    if (!invalidContinueUrl) {
      throw error;
    }

    await callIdentityToolkit("accounts:sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken
    });
  }
}

export async function createFirebaseServerClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const dataClient = createFirebaseDataClient(getFirebaseAdminDb());

  return {
    ...dataClient,
    auth: {
      async getUser() {
        const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
        if (!sessionCookie) {
          clearTrackedSessionCookie(cookieStore);
          return { data: { user: null }, error: null };
        }

        const user = await readFirebaseSessionUser(sessionCookie);
        if (!user) {
          clearSessionCookies(cookieStore);
          return { data: { user: null }, error: null };
        }

        const isValidTrackedSession = await validateTrackedSession({
          dataClient,
          cookieStore,
          headerStore,
          userId: user.id
        });
        if (!isValidTrackedSession) {
          clearSessionCookies(cookieStore);
          return { data: { user: null }, error: null };
        }

        return { data: { user }, error: null };
      },

      async signInWithPassword(args: { email: string; password: string }) {
        try {
          const json = await callIdentityToolkit("accounts:signInWithPassword", {
            email: args.email,
            password: args.password,
            returnSecureToken: true
          });

          const idToken = String(json.idToken);
          const userRecord = await lookupIdentityToolkitUser(idToken);
          const emailVerified = Boolean(userRecord?.emailVerified);

          if (!emailVerified) {
            try {
              await sendVerificationEmail(idToken);
              return {
                data: { user: null },
                error: {
                  message:
                    "Please verify your email before logging in. We sent a new verification link to your inbox."
                }
              };
            } catch {
              return {
                data: { user: null },
                error: {
                  message: "Please verify your email before logging in."
                }
              };
            }
          }

          await setFirebaseSessionCookie(cookieStore, idToken);

          const user: AuthPayload = {
            id: String(json.localId),
            email: (json.email as string | undefined) ?? args.email,
            phone: null
          };

          const tracked = await registerOrReuseSession({
            dataClient,
            cookieStore,
            headerStore,
            userId: user.id,
            email: user.email
          });
          if (!tracked.ok) {
            clearSessionCookies(cookieStore);
            return {
              data: { user: null },
              error: { message: tracked.message }
            };
          }

          return { data: { user }, error: null };
        } catch (error) {
          return {
            data: { user: null },
            error: { message: error instanceof Error ? error.message : "Login failed." }
          };
        }
      },

      async signUp(args: { email: string; password: string; options?: Record<string, unknown> }) {
        try {
          const json = await callIdentityToolkit("accounts:signUp", {
            email: args.email,
            password: args.password,
            returnSecureToken: true
          });
          await sendVerificationEmail(String(json.idToken));

          const user: AuthPayload = {
            id: String(json.localId),
            email: (json.email as string | undefined) ?? args.email,
            phone: null
          };

          return {
            data: {
              user,
              session: null
            },
            error: null
          };
        } catch (error) {
          return {
            data: { user: null, session: null },
            error: { message: error instanceof Error ? error.message : "Signup failed." }
          };
        }
      },

      async signOut() {
        const trackedSessionId = cleanText(cookieStore.get(FIREBASE_TRACKED_SESSION_COOKIE)?.value, 80);
        if (trackedSessionId) {
          await revokeSession({
            dataClient,
            sessionId: trackedSessionId,
            reason: "manual_signout"
          }).catch(() => {});
        }

        clearSessionCookies(cookieStore);
        return { error: null };
      },

      async signInWithOtp(_args?: { phone?: string }) {
        return {
          error: {
            message: "Phone OTP sign-in is not enabled in this Firebase migration yet. Use email/password or Google login."
          }
        };
      },

      async verifyOtp(_args?: { phone?: string; token?: string; type?: string }) {
        return {
          error: {
            message: "Phone OTP verification is not enabled in this Firebase migration yet."
          }
        };
      }
    }
  };
}
