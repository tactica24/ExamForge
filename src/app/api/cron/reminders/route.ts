import { NextResponse } from "next/server";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { getServerEnv } from "@/lib/env";
import { sendViaProvider, type Channel } from "@/lib/notifications/providers";

type ReminderItem = {
  time: string;
  channel: Channel;
  destination: string | null;
};

type ProviderMetaRecord = {
  reminder_key?: string;
  attempt_count?: number;
  max_attempts?: number;
  next_attempt_at?: string | null;
  destination?: { email?: string | null; phone?: string | null };
  whatsapp_template?: string;
  history?: Array<Record<string, unknown>>;
};

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

function parseReminderList(pref: any, fallbackChannel: Channel, fallbackDestination: string): ReminderItem[] {
  const raw = Array.isArray(pref?.reminders)
    ? pref.reminders
    : [
        {
          time: pref?.reminder_time,
          channel: fallbackChannel,
          destination: fallbackDestination
        }
      ];

  return raw
    .map((item: any): ReminderItem => ({
      time: String(item?.time ?? "").trim(),
      channel: String(item?.channel ?? fallbackChannel).trim() as Channel,
      destination: String(item?.destination ?? "").trim() || null
    }))
    .filter(
      (item: ReminderItem) =>
        /^\d{2}:\d{2}$/.test(item.time) && ["in_app", "sms", "whatsapp", "email"].includes(item.channel)
    );
}

function buildReminderMessage(args: { count: number; template: string; channel: Channel }) {
  const base = `you have ${args.count} task${args.count === 1 ? "" : "s"} today`;

  if (args.channel === "whatsapp") {
    if (args.template === "countdown") {
      return `ACE NAIJA countdown: ${base}. Keep your exam momentum and complete your objective questions now.`;
    }
    if (args.template === "streak") {
      return `ACE NAIJA streak check: ${base}. Finish today's plan to protect your consistency streak.`;
    }
    return `ACE NAIJA coach reminder: ${base}. Start with your first topic and complete one objective block now.`;
  }

  return `ACE NAIJA reminder: ${base}. Take your objective questions and keep your streak.`;
}

function parseProviderMeta(value: unknown): ProviderMetaRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ProviderMetaRecord;
}

function toIso(value: Date) {
  return value.toISOString();
}

function toMs(value: string | null | undefined) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function retryBackoffMs(attempt: number) {
  const minutes = Math.min(60, 5 * Math.pow(2, Math.max(0, attempt - 1)));
  return minutes * 60 * 1000;
}

function canUseWhatsApp(pref: any) {
  const consents = pref?.consents && typeof pref.consents === "object" ? (pref.consents as Record<string, unknown>) : {};
  return Boolean(consents.whatsapp);
}

export async function GET(req: Request) {
  const env = getServerEnv();
  const secret = req.headers.get("x-cron-secret");
  if (!env.APP_CRON_SECRET || secret !== env.APP_CRON_SECRET) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const admin = createBackendAdminClient();
  const now = new Date();
  const nowIso = toIso(now);
  const today = nowIso.slice(0, 10);

  const { data: prefs, error: prefsErr } = await admin
    .from("notification_prefs")
    .select("user_id,channels,reminder_time,reminders,consents,whatsapp_template")
    .limit(5000);
  if (prefsErr) return NextResponse.json({ ok: false, message: prefsErr.message }, { status: 500 });

  const userIds = (prefs ?? []).map((p) => p.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("user_id,email,phone,timezone").in("user_id", userIds)
    : { data: [] as any[] };
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  let enqueued = 0;
  let skippedConsent = 0;
  let skippedNoDestination = 0;

  for (const pref of prefs ?? []) {
    const profile = profileByUserId.get(pref.user_id);
    const tz = profile?.timezone ?? "Africa/Lagos";
    const local = getLocalTimeHHmm(tz, now);

    const primaryChannel = Array.isArray(pref.channels) ? (String(pref.channels[0] ?? "in_app") as Channel) : "in_app";
    const fallbackDestination = String(profile?.phone ?? profile?.email ?? "");
    const reminderList = parseReminderList(pref, primaryChannel, fallbackDestination);

    const { data: plan } = await admin
      .from("user_plans")
      .select("id")
      .eq("user_id", pref.user_id)
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

    for (const reminder of reminderList) {
      if (local !== reminder.time) continue;

      if (reminder.channel === "whatsapp" && !canUseWhatsApp(pref)) {
        skippedConsent += 1;
        continue;
      }

      const destination = {
        email: reminder.channel === "email" ? (reminder.destination || profile?.email || null) : null,
        phone:
          reminder.channel === "sms" || reminder.channel === "whatsapp"
            ? reminder.destination || profile?.phone || null
            : null
      };

      if ((reminder.channel === "email" && !destination.email) || ((reminder.channel === "sms" || reminder.channel === "whatsapp") && !destination.phone)) {
        skippedNoDestination += 1;
        continue;
      }

      const whatsappTemplateRaw = String((pref as any)?.whatsapp_template ?? "coach").trim().toLowerCase();
      const whatsappTemplate = ["coach", "countdown", "streak"].includes(whatsappTemplateRaw)
        ? whatsappTemplateRaw
        : "coach";

      const msg = buildReminderMessage({
        count,
        template: whatsappTemplate,
        channel: reminder.channel
      });

      const reminderKey = `${today}:${pref.user_id}:${plan.id}:${reminder.channel}:${reminder.time}`;
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", pref.user_id)
        .eq("notif_type", "reminder")
        .eq("channel", reminder.channel)
        .eq("provider_meta.reminder_key", reminderKey)
        .limit(1)
        .maybeSingle();
      if (existing?.id) continue;

      const { error } = await admin.from("notifications").insert({
        user_id: pref.user_id,
        channel: reminder.channel,
        notif_type: "reminder",
        message: msg,
        scheduled_for: nowIso,
        sent_at: null,
        status: "queued",
        provider_meta: {
          reminder_key: reminderKey,
          attempt_count: 0,
          max_attempts: 3,
          next_attempt_at: nowIso,
          destination,
          whatsapp_template: whatsappTemplate,
          timezone: tz
        }
      });

      if (!error) enqueued += 1;
    }
  }

  const { data: queue, error: queueErr } = await admin
    .from("notifications")
    .select("*")
    .eq("notif_type", "reminder")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(400);

  if (queueErr) {
    return NextResponse.json({ ok: false, message: queueErr.message }, { status: 500 });
  }

  let sent = 0;
  let retried = 0;
  let permanentlyFailed = 0;

  for (const item of queue ?? []) {
    const meta = parseProviderMeta(item.provider_meta);
    const attemptCount = Math.max(0, Number(meta.attempt_count ?? 0));
    const maxAttempts = Math.max(1, Number(meta.max_attempts ?? 3));
    const nextAttemptMs = toMs(meta.next_attempt_at ?? null);

    if (nextAttemptMs > Date.now()) continue;

    if (attemptCount >= maxAttempts) {
      await admin
        .from("notifications")
        .update({ status: "failed", provider_meta: { ...meta, final: true } })
        .eq("id", item.id);
      permanentlyFailed += 1;
      continue;
    }

    const destination = meta.destination ?? {};
    const provider = await sendViaProvider({
      channel: item.channel as Channel,
      to: {
        email: destination.email ?? null,
        phone: destination.phone ?? null
      },
      message: String(item.message ?? "")
    });

    const historyEntry = {
      ts: nowIso,
      ok: provider.ok,
      provider
    };
    const history = Array.isArray(meta.history) ? [...meta.history, historyEntry].slice(-10) : [historyEntry];

    if (provider.ok) {
      await admin
        .from("notifications")
        .update({
          status: "sent",
          sent_at: nowIso,
          provider_meta: {
            ...meta,
            attempt_count: attemptCount + 1,
            last_provider: provider,
            history
          }
        })
        .eq("id", item.id);
      sent += 1;
      continue;
    }

    const nextAttemptCount = attemptCount + 1;
    if (nextAttemptCount >= maxAttempts) {
      await admin
        .from("notifications")
        .update({
          status: "failed",
          provider_meta: {
            ...meta,
            attempt_count: nextAttemptCount,
            next_attempt_at: null,
            last_provider: provider,
            final: true,
            history
          }
        })
        .eq("id", item.id);
      permanentlyFailed += 1;
    } else {
      const nextAttemptAt = new Date(Date.now() + retryBackoffMs(nextAttemptCount));
      await admin
        .from("notifications")
        .update({
          status: "queued",
          provider_meta: {
            ...meta,
            attempt_count: nextAttemptCount,
            next_attempt_at: toIso(nextAttemptAt),
            last_provider: provider,
            history
          }
        })
        .eq("id", item.id);
      retried += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    enqueued,
    sent,
    retried,
    failed: permanentlyFailed,
    skippedConsent,
    skippedNoDestination
  });
}
