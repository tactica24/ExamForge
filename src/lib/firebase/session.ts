import "server-only";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin-app";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/constants";

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

type CookieSetter = { set: (name: string, value: string, options: Record<string, any>) => unknown };
type CookieDeleter = { delete: (name: string) => unknown };

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000)
  };
}

export async function setFirebaseSessionCookie(store: CookieSetter, idToken: string) {
  const auth = getFirebaseAdminAuth();
  if (!auth) throw new Error("Firebase admin credentials are missing.");

  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  store.set(FIREBASE_SESSION_COOKIE, sessionCookie, cookieOptions());
}

export function clearFirebaseSessionCookie(store: CookieDeleter) {
  store.delete(FIREBASE_SESSION_COOKIE);
}

export async function readFirebaseSessionUser(sessionCookie: string) {
  const auth = getFirebaseAdminAuth();
  if (!auth) return null;

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return {
      id: decoded.uid,
      email: decoded.email ?? null,
      phone: decoded.phone_number ?? null,
      app_metadata: {
        role: (decoded as any).role ?? null
      },
      user_metadata: {
        ...decoded
      }
    };
  } catch {
    return null;
  }
}