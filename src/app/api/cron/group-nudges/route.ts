import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { getServerEnv } from "@/lib/env";

export async function GET(req: Request) {
  const env = getServerEnv();
  const secret = req.headers.get("x-cron-secret");
  if (!env.APP_CRON_SECRET || secret !== env.APP_CRON_SECRET) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const admin = createBackendAdminClient();
  const since = subDays(new Date(), 7).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const { data: groups, error: gErr } = await admin.from("groups").select("id,subject,timezone").limit(2000);
  if (gErr) return NextResponse.json({ ok: false, message: gErr.message }, { status: 500 });

  let nudges = 0;

  for (const g of groups ?? []) {
    const { data: lastSystem } = await admin
      .from("group_messages")
      .select("id,created_at")
      .eq("group_id", g.id)
      .eq("is_system", true)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .limit(1)
      .maybeSingle();
    if (lastSystem) continue;

    const { data: members } = await admin.from("group_members").select("user_id").eq("group_id", g.id);
    const ids = members?.map((m) => m.user_id) ?? [];
    if (ids.length < 2) continue;

    const { data: results } = await admin
      .from("user_quiz_results")
      .select("user_id,created_at")
      .gte("created_at", since)
      .in("user_id", ids)
      .limit(5000);

    const counts = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const r of results ?? []) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);

    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const leader = ranked[0];
    const lagger = ranked[ranked.length - 1];
    if (!leader || !lagger) continue;

    const gap = leader[1] - lagger[1];
    if (gap < 3) continue;

    const { data: pubs } = await admin.from("profile_public").select("user_id,display_name,anonymous").in("user_id", [
      leader[0],
      lagger[0]
    ]);
    const byId = new Map((pubs ?? []).map((p) => [p.user_id, p]));

    const leaderName = byId.get(leader[0])?.anonymous
      ? "A member"
      : byId.get(leader[0])?.display_name ?? "A member";

    const msg = `${leaderName} is ahead by ${gap} objective-question session${gap === 1 ? "" : "s"} on ${g.subject}. Catch up today!`;

    await admin.from("group_messages").insert({
      group_id: g.id,
      user_id: null,
      content: msg,
      flagged: false,
      is_system: true
    });
    nudges += 1;
  }

  return NextResponse.json({ ok: true, nudges });
}

