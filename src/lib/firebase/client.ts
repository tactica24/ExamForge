"use client";

import { GoogleAuthProvider, getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getFirebaseBrowserAuth, getFirebaseBrowserDb } from "@/lib/firebase/browser";

type GroupMessagePayload = {
  new: Record<string, any>;
};

type GroupMessageHandler = (payload: GroupMessagePayload) => void;
const OAUTH_REDIRECT_TARGET_KEY = "oauth_redirect_target";

function toSafeRedirectTarget(raw: string | undefined, fallback: string) {
  try {
    const candidate = String(raw ?? "").trim();
    if (!candidate) return fallback;

    const parsed = new URL(candidate, window.location.origin);
    if (parsed.origin !== window.location.origin) return fallback;
    if (!parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function getFirebaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function shouldFallbackToRedirect(error: unknown) {
  const code = getFirebaseErrorCode(error);
  return (
    code === "auth/popup-blocked" ||
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    code === "auth/internal-error"
  );
}

function formatOAuthError(error: unknown) {
  const code = getFirebaseErrorCode(error);
  const message = error instanceof Error ? error.message : "";
  if (code === "auth/operation-not-allowed") {
    return "Google sign-in is not enabled in Firebase Authentication.";
  }
  if (code === "auth/unauthorized-domain") {
    return "This domain is not in Firebase authorized domains.";
  }
  if (code === "auth/popup-blocked") {
    return "Popup was blocked. Retrying with redirect flow.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Popup was closed before sign-in completed.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error while contacting Firebase.";
  }
  if (code === "auth/internal-error") {
    return "Google sign-in returned an internal Firebase error. Check Firebase OAuth client settings and authorized domains.";
  }
  return message || "Google sign-in failed.";
}

async function establishSessionFromIdToken(idToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ idToken })
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    return { error: { message: payload?.message ?? "Failed to create session." } };
  }

  return { error: null as { message: string } | null };
}

class FirebaseRealtimeChannel {
  private handler: GroupMessageHandler | null = null;
  private table = "";
  private filter = "";
  private unsubscribeFn: (() => void) | null = null;

  on(_event: string, config: { table: string; filter?: string; [key: string]: unknown }, callback: GroupMessageHandler) {
    this.table = config.table;
    this.filter = config.filter ?? "";
    this.handler = callback;
    return this;
  }

  subscribe() {
    if (!this.handler) return this;
    if (this.table !== "group_messages") return this;

    const db = getFirebaseBrowserDb();
    const groupId = this.parseGroupIdFromFilter(this.filter);
    if (!groupId) return this;

    const q = query(collection(db, "group_messages"), where("group_id", "==", groupId));

    let initialSnapshot = true;
    this.unsubscribeFn = onSnapshot(q, (snapshot: any) => {
      if (initialSnapshot) {
        initialSnapshot = false;
        return;
      }

      snapshot.docChanges().forEach((change: any) => {
        if (change.type !== "added") return;
        this.handler?.({ new: { id: change.doc.id, ...change.doc.data() } });
      });
    });

    return this;
  }

  unsubscribe() {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
  }

  private parseGroupIdFromFilter(filter: string) {
    // Expected format: group_id=eq.<value>
    const marker = "group_id=eq.";
    if (!filter.startsWith(marker)) return null;
    return filter.slice(marker.length);
  }
}

export function createFirebaseBrowserClient() {
  return {
    auth: {
      async signInWithOAuth(args: { provider: "google"; options?: { redirectTo?: string } }) {
        const auth = getFirebaseBrowserAuth();
        const fallbackTarget = `${window.location.origin}/dashboard`;
        const redirectTarget = toSafeRedirectTarget(args.options?.redirectTo, fallbackTarget);

        try {
          if (args.provider !== "google") {
            return { error: { message: "Only Google OAuth is currently supported." } };
          }

          const provider = new GoogleAuthProvider();
          const cred = await signInWithPopup(auth, provider);
          const idToken = await cred.user.getIdToken();
          const session = await establishSessionFromIdToken(idToken);
          if (session.error) return session;

          if (redirectTarget) {
            window.location.assign(redirectTarget);
          }

          return { error: null };
        } catch (error) {
          if (shouldFallbackToRedirect(error)) {
            try {
              window.sessionStorage.setItem(OAUTH_REDIRECT_TARGET_KEY, redirectTarget);
            } catch {
              // ignore storage failures
            }
            const provider = new GoogleAuthProvider();
            await signInWithRedirect(auth, provider);
            return { error: null };
          }

          return { error: { message: formatOAuthError(error) } };
        }
      },
      async completeOAuthRedirect() {
        try {
          const auth = getFirebaseBrowserAuth();
          const cred = await getRedirectResult(auth);
          if (!cred?.user) return { handled: false, error: null as { message: string } | null };

          const idToken = await cred.user.getIdToken();
          const session = await establishSessionFromIdToken(idToken);
          if (session.error) return { handled: true, error: session.error };

          const fallbackTarget = `${window.location.origin}/dashboard`;
          let redirectTo = fallbackTarget;
          try {
            const stored = window.sessionStorage.getItem(OAUTH_REDIRECT_TARGET_KEY);
            if (stored) redirectTo = toSafeRedirectTarget(stored, fallbackTarget);
            window.sessionStorage.removeItem(OAUTH_REDIRECT_TARGET_KEY);
          } catch {
            // ignore storage failures
          }

          return { handled: true, redirectTo, error: null as { message: string } | null };
        } catch (error) {
          return { handled: true, error: { message: formatOAuthError(error) } };
        }
      }
    },
    channel(_name?: string) {
      return new FirebaseRealtimeChannel();
    },
    removeChannel(channel: FirebaseRealtimeChannel) {
      channel.unsubscribe();
    }
  };
}
