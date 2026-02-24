import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { recomputeLeaderboards } from "@/lib/leaderboard/recompute";

export async function GET(req: Request) {
  const env = getServerEnv();
  const secret = req.headers.get("x-cron-secret");
  if (!env.APP_CRON_SECRET || secret !== env.APP_CRON_SECRET) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await recomputeLeaderboards();
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    computed_at: result.computedAt,
    written: result.written
  });
}
