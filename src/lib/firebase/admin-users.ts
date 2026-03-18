import "server-only";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin-app";
import { createFirebaseServerClient } from "@/lib/firebase/server";

type FirebaseServerClient = Awaited<ReturnType<typeof createFirebaseServerClient>>;

export type AdminAuthUser = {
  uid: string;
  email: string | null;
  role: "admin" | "user";
  created_at: string | null;
};

export type AdminDirectoryUser = {
  user_id: string;
  email: string | null;
  name: string | null;
  display_name: string | null;
  subscription_tier: string | null;
  created_at: string | null;
  role: "admin" | "user";
};

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function toMs(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sortNewestFirst<T extends { created_at?: string | null }>(rows: T[]) {
  return [...rows].sort((left, right) => toMs(right.created_at) - toMs(left.created_at));
}

export async function listFirebaseAuthUsers(args?: { maxPages?: number; pageSize?: number }) {
  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return { ok: false as const, users: [] as AdminAuthUser[] };
  }

  const users: AdminAuthUser[] = [];
  const pageSize = Math.max(1, Math.min(1000, args?.pageSize ?? 1000));
  const maxPages = Math.max(1, Math.min(50, args?.maxPages ?? 20));

  let pageToken: string | undefined;
  let page = 0;

  do {
    const result = await auth.listUsers(pageSize, pageToken);
    result.users.forEach((entry) => {
      users.push({
        uid: entry.uid,
        email: entry.email ?? null,
        role: entry.customClaims?.role === "admin" ? "admin" : "user",
        created_at: entry.metadata.creationTime || null
      });
    });
    pageToken = result.pageToken;
    page += 1;
  } while (pageToken && page < maxPages);

  return {
    ok: true as const,
    users: sortNewestFirst(users)
  };
}

export async function getAdminUserDirectory(args: {
  firebase: FirebaseServerClient;
  maxPages?: number;
  pageSize?: number;
}) {
  const authUsers = await listFirebaseAuthUsers({
    maxPages: args.maxPages,
    pageSize: args.pageSize
  });

  if (!authUsers.ok) {
    return {
      ok: false as const,
      users: [] as AdminDirectoryUser[],
      totalUsers: 0,
      totalAdmins: 0,
      totalPro: 0
    };
  }

  const profileByUid = new Map<string, Record<string, unknown>>();

  for (const batch of chunk(authUsers.users.map((entry) => entry.uid), 30)) {
    const { data: profiles } = await args.firebase
      .from("profiles")
      .select("user_id,email,name,display_name,subscription_tier,created_at")
      .in("user_id", batch);

    for (const profile of profiles ?? []) {
      const userId = String((profile as any)?.user_id ?? "").trim();
      if (userId) profileByUid.set(userId, profile as Record<string, unknown>);
    }
  }

  const users = authUsers.users.map((entry) => {
    const profile = profileByUid.get(entry.uid);
    return {
      user_id: entry.uid,
      email: String(profile?.email ?? entry.email ?? "").trim() || null,
      name: String(profile?.name ?? "").trim() || null,
      display_name: String(profile?.display_name ?? "").trim() || null,
      subscription_tier: String(profile?.subscription_tier ?? "").trim() || null,
      created_at: String(entry.created_at ?? profile?.created_at ?? "").trim() || null,
      role: entry.role
    } satisfies AdminDirectoryUser;
  });

  return {
    ok: true as const,
    users: sortNewestFirst(users),
    totalUsers: authUsers.users.length,
    totalAdmins: authUsers.users.filter((entry) => entry.role === "admin").length,
    totalPro: users.filter((entry) => (entry.subscription_tier ?? "").toLowerCase() === "pro").length
  };
}
