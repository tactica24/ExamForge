"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getFirebaseBrowserAuth, getFirebaseBrowserDb } from "@/lib/firebase/browser";

type GroupMessagePayload = {
  new: Record<string, any>;
};

type GroupMessageHandler = (payload: GroupMessagePayload) => void;

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
        try {
          if (args.provider !== "google") {
            return { error: { message: "Only Google OAuth is currently supported." } };
          }

          const auth = getFirebaseBrowserAuth();
          const provider = new GoogleAuthProvider();
          const cred = await signInWithPopup(auth, provider);
          const idToken = await cred.user.getIdToken();

          const res = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => null);
            return { error: { message: payload?.message ?? "Failed to create session." } };
          }

          if (args.options?.redirectTo) {
            window.location.assign(args.options.redirectTo);
          }

          return { error: null };
        } catch (error) {
          const message = error instanceof Error ? error.message : "OAuth failed.";
          return { error: { message } };
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
