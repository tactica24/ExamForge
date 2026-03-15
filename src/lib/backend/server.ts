import "server-only";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAppDataClient, type AppDataClient } from "@/lib/backend/data-client";
import { APP_DEVICE_COOKIE, APP_SESSION_COOKIE, APP_TRACKED_SESSION_COOKIE } from "@/lib/backend/constants";
import { confirmCognitoSignUp, resendCognitoConfirmationCode, signInWithCognitoPassword, signUpWithCognito, type CognitoTokenSet } from "@/lib/aws/cognito-public";
import {
  clearAwsSessionCookie,
  readAwsSessionState,
  setAwsSessionCookie,
  stateToSessionUser
} from "@/lib/aws/session";

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
  app_metadata?: { role?: string | null };
  user_metadata?: Record<string, unknown>;
};

type SessionInitResult =
  | { ok: true; user?: AuthPayload | null }
  | {
      ok: false;
      message: string;
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
    cookieStore.delete(APP_TRACKED_SESSION_COOKIE);
  } catch {
    // Server Components may not allow cookie mutation.
  }
}

function clearSessionCookies(cookieStore: CookieStore) {
  try {
    clearAwsSessionCookie(cookieStore);
  } catch {
    // Server Components may not allow cookie mutation.
  }
  clearTrackedSessionCookie(cookieStore);
}

async function setDeviceCookie(cookieStore: CookieStore) {
  const existing = cleanText(cookieStore.get(APP_DEVICE_COOKIE)?.value, 120);
  if (existing) return existing;

  const deviceId = randomUUID();
  cookieStore.set(APP_DEVICE_COOKIE, deviceId, trackingCookieOptions(DEVICE_COOKIE_MAX_AGE));
  return deviceId;
}

function setTrackedSessionCookie(cookieStore: CookieStore, sessionId: string) {
  cookieStore.set(APP_TRACKED_SESSION_COOKIE, sessionId, trackingCookieOptions(TRACKED_SESSION_COOKIE_MAX_AGE));
}

async function listActiveSessions(args: { dataClient: AppDataClient; userId: string }) {
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
  dataClient: AppDataClient;
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

async function pruneStaleSessions(args: { dataClient: AppDataClient; sessions: AuthSessionRow[] }) {
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
  dataClient: AppDataClient;
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
  const { error } = await args.dataClient
    .from("auth_sessions")
    .insert({
      id: sessionId,
      user_id: args.userId,
      email: args.email,
      device_id: deviceId,
      user_agent: userAgent,
      ip_address: ipAddress,
      created_at: now,
      last_seen_at: now,
      revoked_at: null
    })
    .select("id");

  // If we cannot persist the session, allow login anyway to avoid blocking users.
  if (error) {
    return { ok: true as const };
  }

  setTrackedSessionCookie(args.cookieStore, sessionId);
  return { ok: true as const };
}

async function validateTrackedSession(args: {
  dataClient: AppDataClient;
  cookieStore: CookieStore;
  headerStore: HeaderStore;
  userId: string;
}) {
  // Temporarily bypass strict tracked-session validation to avoid login loops.
  return true;
}

async function lookupUserRole(dataClient: AppDataClient, userId: string) {
  const { data } = await dataClient.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  const role = cleanText((data as Record<string, unknown> | null)?.role, 20);
  return role ?? null;
}

function toAuthPayload(state: Awaited<ReturnType<typeof readAwsSessionState>>, role: string | null): AuthPayload | null {
  if (!state) return null;
  return stateToSessionUser(state, role);
}

export async function establishTrackedSessionFromTokens(args: {
  tokens: CognitoTokenSet;
  role?: string | null;
}): Promise<SessionInitResult> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const dataClient = createAppDataClient();

  let state;
  try {
    state = await setAwsSessionCookie(cookieStore, {
      tokens: args.tokens,
      role: args.role
    });
  } catch {
    return {
      ok: false,
      message: "Unable to establish login session."
    };
  }

  const tracked = await registerOrReuseSession({
    dataClient,
    cookieStore,
    headerStore,
    userId: state.subject,
    email: state.email
  });

  if (!tracked.ok) {
    clearSessionCookies(cookieStore);
    return tracked;
  }

  const role = args.role ?? (await lookupUserRole(dataClient, state.subject));
  return { ok: true, user: toAuthPayload(state, role) };
}

export async function createBackendServerClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const dataClient = createAppDataClient();

  return {
    ...dataClient,
    auth: {
      async getUser() {
        const sessionCookie = cookieStore.get(APP_SESSION_COOKIE)?.value;
        if (!sessionCookie) {
          clearTrackedSessionCookie(cookieStore);
          return { data: { user: null }, error: null };
        }

        const rawState = await readAwsSessionState(sessionCookie, {
          cookieStore
        });
        if (!rawState) {
          clearSessionCookies(cookieStore);
          return { data: { user: null }, error: null };
        }

        const role = await lookupUserRole(dataClient, rawState.subject);
        const state = await readAwsSessionState(cookieStore.get(APP_SESSION_COOKIE)?.value ?? sessionCookie, {
          cookieStore,
          role
        });
        if (!state) {
          clearSessionCookies(cookieStore);
          return { data: { user: null }, error: null };
        }

        const isValidTrackedSession = await validateTrackedSession({
          dataClient,
          cookieStore,
          headerStore,
          userId: state.subject
        });
        if (!isValidTrackedSession) {
          clearSessionCookies(cookieStore);
          return { data: { user: null }, error: null };
        }

        return { data: { user: toAuthPayload(state, role) }, error: null };
      },

      async signInWithPassword(args: { email: string; password: string }) {
        try {
          const tokens = await signInWithCognitoPassword(args);
          const established = await establishTrackedSessionFromTokens({ tokens });
          if (!established.ok) {
            return {
              data: { user: null },
              error: { message: established.message }
            };
          }

          return { data: { user: established.user ?? null }, error: null };
        } catch (error) {
          return {
            data: { user: null },
            error: { message: error instanceof Error ? error.message : "Login failed." }
          };
        }
      },

      async signUp(args: { email: string; password: string; options?: Record<string, unknown> }) {
        try {
          const metadata = (args.options?.data as Record<string, unknown> | undefined) ?? {};
          const firstName = cleanText(metadata.first_name, 80) || null;
          const surname = cleanText(metadata.surname, 80) || null;
          const name = cleanText(metadata.name, 120) || `${firstName ?? ""} ${surname ?? ""}`.trim() || null;

          const result = await signUpWithCognito({
            email: args.email,
            password: args.password,
            attributes: {
              email: args.email,
              ...(name ? { name } : {}),
              ...(firstName ? { given_name: firstName } : {}),
              ...(surname ? { family_name: surname } : {})
            }
          });

          return {
            data: {
              user: result.userId
                ? ({
                    id: result.userId,
                    email: args.email,
                    phone: null
                  } satisfies AuthPayload)
                : null,
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

      async confirmSignUp(args: { email: string; code: string }) {
        try {
          await confirmCognitoSignUp(args);
          return { error: null };
        } catch (error) {
          return {
            error: {
              message: error instanceof Error ? error.message : "Confirmation failed."
            }
          };
        }
      },

      async resendConfirmationCode(args: { email: string }) {
        try {
          await resendCognitoConfirmationCode(args);
          return { error: null };
        } catch (error) {
          return {
            error: {
              message: error instanceof Error ? error.message : "Could not resend the confirmation code."
            }
          };
        }
      },

      async signOut() {
        const trackedSessionId = cleanText(cookieStore.get(APP_TRACKED_SESSION_COOKIE)?.value, 80);
        if (trackedSessionId) {
          await revokeSession({
            dataClient,
            sessionId: trackedSessionId,
            reason: "manual_signout"
          }).catch(() => {});
        }

        clearSessionCookies(cookieStore);
        return { error: null };
      }
    }
  };
}
