import "server-only";

import { cookies } from "next/headers";
import { createFirebaseDataClient } from "@/lib/firebase/data-client";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-app";
import {
  clearFirebaseSessionCookie,
  readFirebaseSessionUser,
  setFirebaseSessionCookie
} from "@/lib/firebase/session";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/constants";
import { getAppUrl } from "@/lib/app-url";
import { getServerEnv } from "@/lib/env";

type AuthPayload = {
  id: string;
  email: string | null;
  phone: string | null;
};

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
  const dataClient = createFirebaseDataClient(getFirebaseAdminDb());

  return {
    ...dataClient,
    auth: {
      async getUser() {
        const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
        if (!sessionCookie) {
          return { data: { user: null }, error: null };
        }

        const user = await readFirebaseSessionUser(sessionCookie);
        if (!user) {
          try {
            clearFirebaseSessionCookie(cookieStore);
          } catch {
            // Server Components may not allow cookie mutation.
          }
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
        clearFirebaseSessionCookie(cookieStore);
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
