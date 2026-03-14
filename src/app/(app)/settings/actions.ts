"use server";

import { randomBytes } from "crypto";
import { formatISO } from "date-fns";
import { z } from "zod";
import { createBackendServerClient } from "@/lib/backend/server";
import { isAllowedAssetUrl } from "@/lib/backend/storage";
import { syncProfilePublic } from "@/lib/profile/public";
import { redirect } from "next/navigation";
import { ensureSeedExamExists } from "@/lib/seed/ensure";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";
import { generatePlanItemsFromTopics } from "@/lib/plans/generate";
import { canUseFullAppFeatures } from "@/lib/billing/access";
import { matchOrCreateGroup } from "@/lib/groups/match";
import { paceFromTopicsPerDay } from "@/lib/plans/pace";
import { isPlanItemQuizCompleted } from "@/lib/plans/content";

const ProfileSchema = z.object({
  name: z.string().min(2).max(60),
  display_name: z.string().max(40).optional(),
  avatar_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((value) => !value || isAllowedAssetUrl(value), "Avatar URL must start with http://, https://, or /"),
  location: z.string().max(80).optional(),
  timezone: z.string().min(2).max(60),
  learning_style: z.string().min(2).max(30),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  topics_per_day: z.coerce.number().int().min(1).max(5).default(1),
  preferred_explanation_language: z.enum(["en", "pidgin", "hausa", "yoruba", "igbo"]).default("en"),
  low_data_mode: z.coerce.boolean().default(false),
  leaderboard_anonymous: z.coerce.boolean().default(false)
});

async function realignPendingPlanItemsForPace(args: {
  backend: Awaited<ReturnType<typeof createBackendServerClient>>;
  userId: string;
  pace: string;
}) {
  const { data: plans } = await args.backend
    .from("user_plans")
    .select("id,target_date")
    .eq("user_id", args.userId);
  if (!plans?.length) return;

  const startDate = formatISO(new Date(), { representation: "date" });

  for (const plan of plans) {
    const { data: items } = await args.backend
      .from("plan_items")
      .select("id,title,topic_path,status,resource_links,scheduled_for,day_index,created_at")
      .eq("plan_id", plan.id)
      .order("scheduled_for", { ascending: true })
      .order("day_index", { ascending: true })
      .order("created_at", { ascending: true });

    const pending = (items ?? []).filter(
      (item: any) => item?.status === "todo" && !isPlanItemQuizCompleted(item?.resource_links)
    );
    if (!pending.length) continue;

    const generated = generatePlanItemsFromTopics({
      topics: pending.map((item: any) => ({
        title: String(item?.title ?? item?.topic_path ?? "Topic"),
        path: String(item?.topic_path ?? item?.title ?? "Topic")
      })),
      pace: args.pace,
      startDate,
      targetDate: plan.target_date ?? null
    });

    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index];
      const next = generated[index];
      if (!next) continue;
      if (item.scheduled_for === next.scheduled_for && Number(item.day_index ?? 0) === Number(next.day_index ?? 0)) {
        continue;
      }

      await args.backend
        .from("plan_items")
        .update({
          scheduled_for: next.scheduled_for,
          day_index: next.day_index
        })
        .eq("id", item.id);
    }
  }
}

export async function updateProfileAction(_: unknown, formData: FormData) {
  const parsed = ProfileSchema.safeParse({
    name: formData.get("name"),
    display_name: (formData.get("display_name") as string | null) || undefined,
    avatar_url: (formData.get("avatar_url") as string | null)?.trim() || undefined,
    location: (formData.get("location") as string | null) || undefined,
    timezone: formData.get("timezone"),
    learning_style: formData.get("learning_style"),
    level: formData.get("level"),
    topics_per_day: formData.get("topics_per_day") ?? 1,
    preferred_explanation_language: formData.get("preferred_explanation_language") ?? "en",
    low_data_mode: formData.get("low_data_mode") === "on",
    leaderboard_anonymous: formData.get("leaderboard_anonymous") === "on"
  });
  if (!parsed.success) return { ok: false, message: "Invalid profile fields." };

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { topics_per_day, ...profileUpdate } = parsed.data;
  const { error } = await backend.from("profiles").update(profileUpdate).eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  const pace = paceFromTopicsPerDay(topics_per_day);
  const { error: paceError } = await backend.from("user_plans").update({ pace }).eq("user_id", user.id);
  if (paceError) return { ok: false, message: paceError.message };
  await realignPendingPlanItemsForPace({
    backend,
    userId: user.id,
    pace
  });

  await syncProfilePublic({ userId: user.id }).catch(() => {});
  return { ok: true };
}

const AddExamSubjectSchema = z.object({
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subject: z.string().trim().min(2).max(120)
});

async function ensurePlanForSubject(args: {
  backend: Awaited<ReturnType<typeof createBackendServerClient>>;
  userId: string;
  examId: string;
  examSlug: string;
  subject: string;
}) {
  const { data: profile } = await args.backend
    .from("profiles")
    .select("level,timezone")
    .eq("user_id", args.userId)
    .maybeSingle();

  const { data: existingPlan } = await args.backend
    .from("user_plans")
    .select("id")
    .eq("user_id", args.userId)
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .limit(1)
    .maybeSingle();

  if (existingPlan?.id) return { ok: true as const, created: false as const };

  const { data: templatePlan } = await args.backend
    .from("user_plans")
    .select("mode,pace,start_date,target_date")
    .eq("user_id", args.userId)
    .eq("exam_id", args.examId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mode = (templatePlan?.mode as "solo" | "group" | undefined) ?? "solo";
  const pace = (templatePlan?.pace as string | undefined) ?? "steady";
  const startDate = templatePlan?.start_date ?? formatISO(new Date(), { representation: "date" });
  const targetDate = templatePlan?.target_date ?? null;

  const { data: plan, error: planErr } = await args.backend
    .from("user_plans")
    .insert({
      user_id: args.userId,
      exam_id: args.examId,
      subject: args.subject,
      mode,
      pace,
      start_date: startDate,
      target_date: targetDate
    })
    .select("id")
    .single();

  if (planErr || !plan?.id) {
    return { ok: false as const, message: planErr?.message ?? "Could not create plan." };
  }

  const topics = await getTopicsForExamSubject({
    examId: args.examId,
    examSlug: args.examSlug,
    subject: args.subject
  });

  const items = generatePlanItemsFromTopics({
    topics,
    pace,
    startDate,
    targetDate
  });

  if (!items.length) return { ok: true as const, created: true as const };

  const { error: itemsErr } = await args.backend.from("plan_items").insert(
    items.map((item) => ({
      plan_id: plan.id,
      scheduled_for: item.scheduled_for,
      day_index: item.day_index,
      topic_path: item.topic_path,
      title: item.title,
      resource_links: item.resource_links,
      status: "todo"
    }))
  );

  if (itemsErr) {
    return { ok: false as const, message: itemsErr.message };
  }

  if (mode === "group") {
    await matchOrCreateGroup({
      userId: args.userId,
      examId: args.examId,
      subject: args.subject,
      pace,
      level: profile?.level ?? "beginner",
      timezone: profile?.timezone ?? "Africa/Lagos"
    }).catch(() => {});
  }

  return { ok: true as const, created: true as const };
}

export async function addExamSubjectAction(_: unknown, formData: FormData) {
  const selectionReady = String(formData.get("selection_ready") ?? "").trim();
  if (!selectionReady) {
    return { ok: false, message: "Select an exam and subject." };
  }

  const parsed = AddExamSubjectSchema.safeParse({
    exam_id: String(formData.get("exam_id") ?? "").trim(),
    exam_slug: String(formData.get("exam_slug") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim()
  });

  if (!parsed.success) return { ok: false, message: "Invalid exam subject selection." };

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: profile } = await backend
    .from("profiles")
    .select("subscription_tier,pro_until,created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  let examId = parsed.data.exam_id;
  if (examId.startsWith("fallback-")) {
    try {
      examId = await ensureSeedExamExists({ slug: parsed.data.exam_slug });
    } catch {
      return {
        ok: false,
        message:
          "Seed exam setup requires the configured AWS backend connection. Add the Aurora and S3 environment values, then try again."
      };
    }
  }

  const { data: existingSelection } = await backend
    .from("user_exam_subjects")
    .select("id")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .eq("subject", parsed.data.subject)
    .limit(1)
    .maybeSingle();

  if (!canUseFullAppFeatures(profile) && !existingSelection?.id) {
    const { count } = await backend
      .from("user_exam_subjects")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id)
      .eq("is_active", true);

    if ((count ?? 0) >= 1) {
      return {
        ok: false,
        message:
          "Your 3-day free trial has ended. Upgrade to Pro to add more than 1 exam and 1 subject from /pricing."
      };
    }
  }

  const { error } = await backend.from("user_exam_subjects").upsert(
    {
      user_id: user.id,
      exam_id: examId,
      subject: parsed.data.subject,
      is_active: true
    },
    { onConflict: "user_id,exam_id,subject" }
  );

  if (error) return { ok: false, message: error.message };

  const plan = await ensurePlanForSubject({
    backend,
    userId: user.id,
    examId,
    examSlug: parsed.data.exam_slug,
    subject: parsed.data.subject
  });

  if (!plan.ok) {
    return {
      ok: true,
      message: `Subject added. Plan auto-generation failed: ${plan.message}`
    };
  }

  return {
    ok: true,
    message: plan.created ? "Subject added and study plan generated." : "Subject added. Existing study plan kept."
  };
}

const ReminderSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/),
  channel: z.enum(["in_app", "sms", "whatsapp", "email"]),
  destination: z.string().trim().max(120).optional()
});

export async function updateNotificationPrefsAction(_: unknown, formData: FormData) {
  const reminders = [1, 2, 3]
    .map((idx) => {
      const time = String(formData.get(`reminder_time_${idx}`) ?? "").trim();
      const channel = String(formData.get(`reminder_channel_${idx}`) ?? "").trim();
      const destination = String(formData.get(`reminder_destination_${idx}`) ?? "").trim();

      if (!time && !channel && !destination) return null;

      const parsed = ReminderSchema.safeParse({
        time,
        channel,
        destination: destination || undefined
      });

      if (!parsed.success) return { invalid: true };
      return parsed.data;
    })
    .filter(Boolean);

  if (reminders.some((r: any) => r?.invalid)) {
    return { ok: false, message: "Invalid reminder details. Use HH:MM time and a valid channel." };
  }

  if (!reminders.length) {
    return { ok: false, message: "Add at least one reminder." };
  }

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const whatsappOptIn = formData.get("whatsapp_opt_in") === "on";
  const whatsappTemplateRaw = String(formData.get("whatsapp_template") ?? "coach").trim().toLowerCase();
  const whatsappTemplate = ["coach", "countdown", "streak"].includes(whatsappTemplateRaw)
    ? whatsappTemplateRaw
    : "coach";

  const primary = reminders[0] as { time: string; channel: string } | undefined;
  const { error } = await backend.from("notification_prefs").upsert({
    user_id: user.id,
    reminder_time: primary?.time ?? "19:00",
    channels: primary ? [primary.channel] : ["in_app"],
    reminders,
    consents: {
      whatsapp: whatsappOptIn,
      updated_at: new Date().toISOString()
    },
    whatsapp_template: whatsappTemplate
  });
  if (error) return { ok: false, message: error.message };

  return { ok: true };
}

export async function createParentLinkAction(_: unknown, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim().slice(0, 40) || null;

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  let inserted = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomBytes(18).toString("base64url");
    const { error } = await backend.from("parent_links").insert({
      token,
      user_id: user.id,
      label
    });
    if (!error) {
      inserted = true;
      break;
    }
  }
  if (!inserted) return { ok: false, message: "Could not create parent link right now. Please try again." };

  redirect("/settings");
}


