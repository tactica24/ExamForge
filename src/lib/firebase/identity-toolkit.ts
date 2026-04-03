import "server-only";

import { getAppUrl } from "@/lib/app-url";
import { getServerEnv } from "@/lib/env";

function toRawIdentityToolkitError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? "Authentication failed");
}

export function getIdentityToolkitErrorCode(error: unknown) {
  return toRawIdentityToolkitError(error).trim().toUpperCase();
}

export function normalizeIdentityToolkitError(error: unknown) {
  const code = getIdentityToolkitErrorCode(error);
  if (code.includes("INVALID_LOGIN_CREDENTIALS") || code.includes("INVALID_PASSWORD") || code.includes("EMAIL_NOT_FOUND")) {
    return "Invalid login credentials.";
  }
  if (code.includes("EMAIL_EXISTS")) {
    return "An account with this email already exists.";
  }
  if (code.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
    return "Too many attempts. Try again later.";
  }
  if (code.includes("INVALID_EMAIL") || code.includes("MISSING_EMAIL")) {
    return "Enter a valid email address.";
  }
  return toRawIdentityToolkitError(error);
}

export function isInvalidContinueUrlError(error: unknown) {
  const code = getIdentityToolkitErrorCode(error);
  return (
    code.includes("INVALID_CONTINUE_URI") ||
    code.includes("UNAUTHORIZED_CONTINUE_URI") ||
    code.includes("MISSING_CONTINUE_URI")
  );
}

export async function callIdentityToolkit(endpoint: string, payload: Record<string, unknown>) {
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
    throw new Error(String(json?.error?.message ?? "Authentication failed"));
  }

  return json as Record<string, any>;
}

export function getEmailVerificationContinueUrl() {
  return `${getAppUrl()}/login?verified=1`;
}

export function getPasswordResetContinueUrl() {
  return `${getAppUrl()}/login?reset=1`;
}

export async function sendPasswordResetEmail(email: string) {
  try {
    await callIdentityToolkit("accounts:sendOobCode", {
      requestType: "PASSWORD_RESET",
      email,
      continueUrl: getPasswordResetContinueUrl()
    });
    return;
  } catch (error) {
    if (isInvalidContinueUrlError(error)) {
      await callIdentityToolkit("accounts:sendOobCode", {
        requestType: "PASSWORD_RESET",
        email
      });
      return;
    }

    throw error;
  }
}
