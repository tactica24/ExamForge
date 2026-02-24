import "server-only";

import { startOfMonth, startOfWeek } from "date-fns";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";

type Period = "weekly" | "monthly" | "all_time";

function rankify(map: Map<string, number>) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([user_id, score], idx) => ({ user_id, score, rank: idx + 1 }));
}

export async function recomputeLeaderboards(args?: {
  admin?: ReturnType<typeof createFirebaseAdminClient>;
  now?: Date;
}) {
  const admin = args?.admin ?? createFirebaseAdminClient();
  const now = args?.now ?? new Date();
  const sinceMonth = startOfMonth(now).toISOString();
  const sinceWeek = startOfWeek(now, { weekStartsOn: 1 }).toISOString();

  const { data: events, error: evErr } = await admin
    .from("user_xp_events")
    .select("user_id,xp,created_at")
    .gte("created_at", sinceMonth)
    .limit(100000);
  if (evErr) return { ok: false as const, message: evErr.message };

  const weekly = new Map<string, number>();
  const monthly = new Map<string, number>();

  for (const event of events ?? []) {
    const userId = String((event as any)?.user_id ?? "").trim();
    if (!userId) continue;
    const xp = Number((event as any)?.xp ?? 0) || 0;

    monthly.set(userId, (monthly.get(userId) ?? 0) + xp);
    if (String((event as any)?.created_at ?? "") >= sinceWeek) {
      weekly.set(userId, (weekly.get(userId) ?? 0) + xp);
    }
  }

  const { data: gamification, error: gamErr } = await admin
    .from("user_gamification")
    .select("user_id,total_xp")
    .limit(50000);
  if (gamErr) return { ok: false as const, message: gamErr.message };

  const allTime = new Map<string, number>();
  for (const entry of gamification ?? []) {
    const userId = String((entry as any)?.user_id ?? "").trim();
    if (!userId) continue;
    const total = Number((entry as any)?.total_xp ?? 0) || 0;
    allTime.set(userId, total);
  }

  const computedAt = now.toISOString();
  const periods: Array<[Period, Map<string, number>]> = [
    ["weekly", weekly],
    ["monthly", monthly],
    ["all_time", allTime]
  ];

  let written = 0;
  for (const [period, scores] of periods) {
    const rows = rankify(scores).slice(0, 2000);
    if (!rows.length) continue;

    const { error } = await admin.from("leaderboard_entries").upsert(
      rows.map((row) => ({ ...row, period, computed_at: computedAt })),
      { onConflict: "user_id,period" }
    );
    if (error) return { ok: false as const, message: error.message };
    written += rows.length;
  }

  return { ok: true as const, computedAt, written };
}
