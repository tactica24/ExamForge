import { NextResponse } from "next/server";
import { startOfMonth, startOfWeek } from "date-fns";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";
import { getServerEnv } from "@/lib/env";

type Period = "weekly" | "monthly" | "all_time";

function rankify(map: Map<string, number>) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([user_id, score], idx) => ({ user_id, score, rank: idx + 1 }));
}

export async function GET(req: Request) {
  const env = getServerEnv();
  const secret = req.headers.get("x-cron-secret");
  if (!env.APP_CRON_SECRET || secret !== env.APP_CRON_SECRET) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const admin = createFirebaseAdminClient();
  const now = new Date();
  const sinceMonth = startOfMonth(now).toISOString();
  const sinceWeek = startOfWeek(now, { weekStartsOn: 1 }).toISOString();

  const { data: events, error: evErr } = await admin
    .from("user_xp_events")
    .select("user_id,xp,created_at")
    .gte("created_at", sinceMonth)
    .limit(100000);
  if (evErr) return NextResponse.json({ ok: false, message: evErr.message }, { status: 500 });

  const weekly = new Map<string, number>();
  const monthly = new Map<string, number>();

  for (const e of events ?? []) {
    const uid = e.user_id;
    monthly.set(uid, (monthly.get(uid) ?? 0) + (e.xp ?? 0));
    if (e.created_at >= sinceWeek) {
      weekly.set(uid, (weekly.get(uid) ?? 0) + (e.xp ?? 0));
    }
  }

  const { data: gam, error: gErr } = await admin.from("user_gamification").select("user_id,total_xp").limit(50000);
  if (gErr) return NextResponse.json({ ok: false, message: gErr.message }, { status: 500 });
  const allTime = new Map<string, number>();
  for (const g of gam ?? []) {
    allTime.set(g.user_id, g.total_xp ?? 0);
  }

  const computed_at = now.toISOString();
  const periods: Array<[Period, Map<string, number>]> = [
    ["weekly", weekly],
    ["monthly", monthly],
    ["all_time", allTime]
  ];

  for (const [period, map] of periods) {
    const rows = rankify(map).slice(0, 2000);
    if (!rows.length) continue;
    await admin.from("leaderboard_entries").upsert(
      rows.map((r) => ({ ...r, period, computed_at })),
      { onConflict: "user_id,period" }
    );
  }

  return NextResponse.json({ ok: true, computed_at });
}

