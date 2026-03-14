"use client";

type GroupMessagePayload = {
  new: Record<string, unknown>;
};

type GroupMessageHandler = (payload: GroupMessagePayload) => void;

const GROUP_MESSAGES_POLL_INTERVAL_MS = 15000;

function toSafeRedirectPath(raw: string | undefined, fallback: string) {
  try {
    const candidate = String(raw ?? "").trim();
    if (!candidate) return fallback;

    const parsed = new URL(candidate, window.location.origin);
    if (parsed.origin !== window.location.origin) return fallback;
    if (!parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

class PollingRealtimeChannel {
  private filter = "";
  private handler: GroupMessageHandler | null = null;
  private intervalId: ReturnType<typeof window.setInterval> | null = null;
  private lastSeenAt = "";
  private seenIds = new Set<string>();
  private visibilityHandler: (() => void) | null = null;

  on(_event: string, config: { table: string; filter?: string; [key: string]: unknown }, callback: GroupMessageHandler) {
    this.filter = String(config.filter ?? "");
    this.handler = callback;
    return this;
  }

  subscribe() {
    const groupId = this.parseGroupIdFromFilter(this.filter);
    if (!groupId || !this.handler) return this;

    void this.prime(groupId);

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.stopPolling();
        return;
      }

      void this.poll(groupId);
      this.startPolling(groupId);
    };

    document.addEventListener("visibilitychange", this.visibilityHandler);
    if (!document.hidden) {
      this.startPolling(groupId);
    }

    return this;
  }

  unsubscribe() {
    this.stopPolling();

    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private startPolling(groupId: string) {
    this.stopPolling();
    this.intervalId = window.setInterval(() => {
      if (document.hidden) return;
      void this.poll(groupId);
    }, GROUP_MESSAGES_POLL_INTERVAL_MS);
  }

  private stopPolling() {
    if (!this.intervalId) return;
    window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private async prime(groupId: string) {
    const messages = await this.fetchMessages(groupId);
    messages.forEach((message) => {
      const id = String(message.id ?? "");
      if (id) this.seenIds.add(id);
    });
    this.lastSeenAt = messages[0]?.created_at ? String(messages[0].created_at) : "";
  }

  private async poll(groupId: string) {
    const messages = await this.fetchMessages(groupId, this.lastSeenAt || undefined);
    if (!messages.length) return;

    const ordered = [...messages].sort(
      (a, b) => new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime()
    );

    ordered.forEach((message) => {
      const id = String(message.id ?? "");
      if (!id || this.seenIds.has(id)) return;
      this.seenIds.add(id);
      this.handler?.({ new: message });
    });

    this.lastSeenAt = String(messages[0]?.created_at ?? this.lastSeenAt);
  }

  private async fetchMessages(groupId: string, after?: string) {
    try {
      const url = new URL(`/api/groups/${groupId}/messages`, window.location.origin);
      if (after) url.searchParams.set("after", after);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return [];
      const json = (await res.json().catch(() => null)) as { messages?: Record<string, unknown>[] } | null;
      return Array.isArray(json?.messages) ? json.messages : [];
    } catch {
      return [];
    }
  }

  private parseGroupIdFromFilter(filter: string) {
    const marker = "group_id=eq.";
    if (!filter.startsWith(marker)) return null;
    return filter.slice(marker.length);
  }
}

export function createBackendBrowserClient() {
  return {
    auth: {
      async signInWithOAuth(args: { provider: "google"; options?: { redirectTo?: string } }) {
        if (args.provider !== "google") {
          return { error: { message: "Only Google OAuth is currently supported." } };
        }

        const redirectTo = toSafeRedirectPath(args.options?.redirectTo, "/onboarding");
        window.location.assign(
          `/api/auth/cognito/start?provider=google&redirectTo=${encodeURIComponent(redirectTo)}`
        );
        return { error: null as { message: string } | null };
      },
      async completeOAuthRedirect() {
        return { handled: false, error: null as { message: string } | null };
      }
    },
    channel(_name?: string) {
      return new PollingRealtimeChannel();
    },
    removeChannel(channel: PollingRealtimeChannel) {
      channel.unsubscribe();
    }
  };
}
