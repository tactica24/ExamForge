import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";

export async function GET(_: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, message: "Parent view requires SUPABASE_SERVICE_ROLE_KEY." }, { status: 501 });
  }

  const admin = createSupabaseAdminClient();

  const { data: link, error: linkErr } = await admin
    .from("parent_links")
    .select("token,user_id,revoked_at,label")
    .eq("token", token)
    .maybeSingle();
  if (linkErr || !link) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (link.revoked_at) return NextResponse.json({ ok: false, message: "Link revoked." }, { status: 410 });

  await admin.from("parent_links").update({ last_viewed_at: new Date().toISOString() }).eq("token", token);

  const userId = link.user_id;
  const { data: profile } = await admin.from("profiles").select("display_name,name").eq("user_id", userId).maybeSingle();
  const name = profile?.display_name ?? profile?.name ?? `Learner-${userId.slice(0, 6)}`;

  const { data: gam } = await admin
    .from("user_gamification")
    .select("streak_count,total_xp,level")
    .eq("user_id", userId)
    .maybeSingle();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: results } = await admin
    .from("user_quiz_results")
    .select("score,total,created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);

  const avg =
    results?.length
      ? Math.round(results.reduce((acc, r) => acc + (r.total ? (r.score / r.total) * 100 : 0), 0) / results.length)
      : 0;

  return NextResponse.json({
    ok: true,
    name,
    label: link.label,
    streak: gam?.streak_count ?? 0,
    xp: gam?.total_xp ?? 0,
    level: gam?.level ?? 1,
    avg30: avg
  });
}

