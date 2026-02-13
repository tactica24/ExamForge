import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { sendViaProvider, type Channel } from "@/lib/notifications/providers";

function getLocalTimeHHmm(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

export async function GET(req: Request) {
  const env = getServerEnv();
  const secret = req.headers.get("x-cron-secret");
  if (!env.APP_CRON_SECRET || secret !== env.APP_CRON_SECRET) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: prefs, error: prefsErr } = await admin
    .from("notification_prefs")
    .select("user_id,channels,reminder_time")
    .limit(5000);
  if (prefsErr) return NextResponse.json({ ok: false, message: prefsErr.message }, { status: 500 });

  const userIds = (prefs ?? []).map((p) => p.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("user_id,email,phone,timezone").in("user_id", userIds)
    : { data: [] as any[] };
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  let sent = 0;

  for (const p of prefs ?? []) {
    const profile = profileByUserId.get(p.user_id);
    const tz = profile?.timezone ?? "Africa/Lagos";
    const local = getLocalTimeHHmm(tz, now);
    if (local !== p.reminder_time) continue;

    const { data: plan } = await admin
      .from("user_plans")
      .select("id")
      .eq("user_id", p.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) continue;

    const { data: items } = await admin
      .from("plan_items")
      .select("id")
      .eq("plan_id", plan.id)
      .eq("scheduled_for", today)
      .eq("status", "todo");

    const count = items?.length ?? 0;
    if (count === 0) continue;

    const channel = (Array.isArray(p.channels) ? (p.channels[0] as Channel) : "in_app") ?? "in_app";
    const msg = `ExamForge reminder: you have ${count} task${count === 1 ? "" : "s"} today. Take your quiz and keep your streak.`;

    const provider = await sendViaProvider({
      channel,
      to: { email: profile?.email, phone: profile?.phone },
      message: msg
    });

    await admin.from("notifications").insert({
      user_id: p.user_id,
      channel,
      notif_type: "reminder",
      message: msg,
      scheduled_for: now.toISOString(),
      sent_at: provider.ok ? now.toISOString() : null,
      status: provider.ok ? "sent" : "failed",
      provider_meta: provider
    });

    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
