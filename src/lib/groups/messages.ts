import "server-only";

import type { AppDataClient } from "@/lib/backend/data-client";

export type GroupMessageView = {
  id: string;
  user_id: string | null;
  content: string;
  flagged: boolean;
  is_system?: boolean;
  created_at: string;
  author_name?: string | null;
};

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function displayNameForUser(args: {
  userId: string | null;
  displayName?: unknown;
  name?: unknown;
}) {
  const displayName = String(args.displayName ?? "").trim();
  if (displayName) return displayName;

  const name = String(args.name ?? "").trim();
  if (name) return name;

  if (!args.userId) return null;
  return `Learner-${args.userId.slice(0, 6)}`;
}

export async function withGroupMessageAuthors(args: {
  backend: Pick<AppDataClient, "from">;
  messages: GroupMessageView[];
}) {
  const userIds = Array.from(
    new Set(args.messages.map((message) => String(message.user_id ?? "").trim()).filter(Boolean))
  );

  if (!userIds.length) return args.messages;

  const profiles = new Map<string, { display_name?: unknown; name?: unknown }>();
  for (const batch of chunk(userIds, 30)) {
    const { data } = await args.backend
      .from("profiles")
      .select("user_id,display_name,name")
      .in("user_id", batch);

    for (const row of data ?? []) {
      const userId = String((row as Record<string, unknown>).user_id ?? "").trim();
      if (!userId) continue;
      profiles.set(userId, row as { display_name?: unknown; name?: unknown });
    }
  }

  return args.messages.map((message) => {
    const userId = String(message.user_id ?? "").trim() || null;
    const profile = userId ? profiles.get(userId) : null;
    return {
      ...message,
      author_name: displayNameForUser({
        userId,
        displayName: profile?.display_name,
        name: profile?.name
      })
    };
  });
}
