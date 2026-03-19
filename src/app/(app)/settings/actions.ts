"use server";

import { randomBytes } from "crypto";
import { formatISO } from "date-fns";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { syncProfilePublic } from "@/lib/profile/public";
import { redirect } from "next/navigation";
import { ensureSeedExamExists } from "@/lib/seed/ensure";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";
import { generatePlanItemsFromTopics } from "@/lib/plans/generate";
import { hasActiveProAccess } from "@/lib/billing/access";
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
    .refine((value) => !value || /^https?:\/\//i.test(value), "Avatar URL must start with http:// or https://"),
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
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  pace: string;
}) {
  const { data: plans } = await args.firebase
    .from("user_plans")
    .select("id,target_date")
    .eq("user_id", args.userId);
  if (!plans?.length) return;

  const startDate = formatISO(new Date(), { representation: "date" });

  for (const plan of plans) {
    const { data: items } = await args.firebase
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

      await args.firebase
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

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { topics_per_day, ...profileUpdate } = parsed.data;
  const { error } = await firebase.from("profiles").update(profileUpdate).eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  const pace = paceFromTopicsPerDay(topics_per_day);
  const { error: paceError } = await firebase.from("user_plans").update({ pace }).eq("user_id", user.id);
  if (paceError) return { ok: false, message: paceError.message };
  await realignPendingPlanItemsForPace({
    firebase,
    userId: user.id,
    pace
  });

  await syncProfilePublic({ userId: user.id }).catch(() => {});
  return { ok: true };
}

const AddExamSubjectSchema = z.object({
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subjects: z.array(z.string().trim().min(2).max(120)).min(1).max(7)
});

const UpdateSubjectModeSchema = z.object({
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subject: z.string().trim().min(2).max(120),
  mode: z.enum(["solo", "group"])
});

async function ensurePlanForSubject(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  examId: string;
  examSlug: string;
  subject: string;
}) {
  const { data: accessProfile } = await args.firebase
    .from("profiles")
    .select("subscription_tier,pro_until")
    .eq("user_id", args.userId)
    .maybeSingle();
  if (!hasActiveProAccess(accessProfile)) {
    return { ok: false as const, message: "Upgrade is required to generate a new study plan." };
  }

  const { data: profile } = await args.firebase
    .from("profiles")
    .select("level,timezone")
    .eq("user_id", args.userId)
    .maybeSingle();

  const { data: existingPlan } = await args.firebase
    .from("user_plans")
    .select("id")
    .eq("user_id", args.userId)
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .limit(1)
    .maybeSingle();

  if (existingPlan?.id) return { ok: true as const, created: false as const };

  const { data: templatePlan } = await args.firebase
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

  const { data: plan, error: planErr } = await args.firebase
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

  const { error: itemsErr } = await args.firebase.from("plan_items").insert(
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
    return { ok: false, message: "Select an exam and at least one subject." };
  }

  const parsed = AddExamSubjectSchema.safeParse({
    exam_id: String(formData.get("exam_id") ?? "").trim(),
    exam_slug: String(formData.get("exam_slug") ?? "").trim(),
    subjects: formData.getAll("subjects").map((value) => String(value).trim()).filter(Boolean)
  });

  if (!parsed.success) return { ok: false, message: "Invalid exam subject selection." };

  const redirectTo = String(formData.get("redirect_to") ?? "").trim();

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: profile } = await firebase
    .from("profiles")
    .select("subscription_tier,pro_until")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!hasActiveProAccess(profile)) {
    redirect("/pricing");
  }

  let examId = parsed.data.exam_id;
  if (examId.startsWith("fallback-")) {
    try {
      examId = await ensureSeedExamExists({ slug: parsed.data.exam_slug });
    } catch {
      return {
        ok: false,
        message:
          "Seed exam setup requires Firebase admin credentials. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
      };
    }
  }

  const { data: existingProfile } = await firebase
    .from("profiles")
    .select("exam_interest_slugs")
    .eq("user_id", user.id)
    .maybeSingle();

  const examInterestSlugs = Array.isArray(existingProfile?.exam_interest_slugs)
    ? Array.from(
        new Set([...existingProfile.exam_interest_slugs.map((item: any) => String(item)), parsed.data.exam_slug])
      )
    : [parsed.data.exam_slug];

  await firebase.from("profiles").update({ exam_interest_slugs: examInterestSlugs }).eq("user_id", user.id);

  const { error } = await firebase.from("user_exam_subjects").upsert(
    parsed.data.subjects.map((subject) => ({
      user_id: user.id,
      exam_id: examId,
      subject,
      is_active: true
    })),
    { onConflict: "user_id,exam_id,subject" }
  );

  if (error) return { ok: false, message: error.message };

  const createdSubjects: string[] = [];
  const planFailures: string[] = [];

  for (const subject of parsed.data.subjects) {
    const plan = await ensurePlanForSubject({
      firebase,
      userId: user.id,
      examId,
      examSlug: parsed.data.exam_slug,
      subject
    });

    if (!plan.ok) {
      planFailures.push(`${subject}: ${plan.message}`);
      continue;
    }

    if (plan.created) createdSubjects.push(subject);
  }

  if (planFailures.length) {
    return {
      ok: true,
      message: `Subjects saved. Some plans still need attention: ${planFailures.join(" | ")}`
    };
  }

  if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
    redirect(redirectTo);
  }

  return {
    ok: true,
    message: createdSubjects.length
      ? `Added ${parsed.data.subjects.length} subject${parsed.data.subjects.length === 1 ? "" : "s"} and generated the new study plan${createdSubjects.length === 1 ? "" : "s"}.`
      : `Added ${parsed.data.subjects.length} subject${parsed.data.subjects.length === 1 ? "" : "s"}. Existing study plans were kept.`
  };
}

export async function updateSubjectModeAction(_: unknown, formData: FormData) {
  const parsed = UpdateSubjectModeSchema.safeParse({
    exam_id: String(formData.get("exam_id") ?? "").trim(),
    exam_slug: String(formData.get("exam_slug") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim(),
    mode: String(formData.get("mode") ?? "").trim().toLowerCase()
  });

  if (!parsed.success) return { ok: false, message: "Invalid subject mode update." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: profile } = await firebase
    .from("profiles")
    .select("subscription_tier,pro_until,level,timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (parsed.data.mode === "group" && !hasActiveProAccess(profile)) {
    redirect("/pricing");
  }

  let { data: plans } = await firebase
    .from("user_plans")
    .select("id,pace")
    .eq("user_id", user.id)
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject)
    .order("created_at", { ascending: false });

  if (!plans?.length) {
    const ensured = await ensurePlanForSubject({
      firebase,
      userId: user.id,
      examId: parsed.data.exam_id,
      examSlug: parsed.data.exam_slug,
      subject: parsed.data.subject
    });

    if (!ensured.ok) {
      return { ok: false, message: ensured.message };
    }

    const refreshed = await firebase
      .from("user_plans")
      .select("id,pace")
      .eq("user_id", user.id)
      .eq("exam_id", parsed.data.exam_id)
      .eq("subject", parsed.data.subject)
      .order("created_at", { ascending: false });
    plans = refreshed.data ?? [];
  }

  if (!plans?.length) {
    return { ok: false, message: "Could not find a study plan for this subject yet." };
  }

  const { error: updateErr } = await firebase
    .from("user_plans")
    .update({ mode: parsed.data.mode })
    .eq("user_id", user.id)
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject);
  if (updateErr) return { ok: false, message: updateErr.message };

  revalidatePath("/settings");
  revalidatePath("/groups");

  if (parsed.data.mode === "group") {
    let groupId: string;
    try {
      groupId = await matchOrCreateGroup({
        userId: user.id,
        examId: parsed.data.exam_id,
        subject: parsed.data.subject,
        pace: String((plans[0] as any)?.pace ?? "steady"),
        level: profile?.level ?? "beginner",
        timezone: profile?.timezone ?? "Africa/Lagos"
      });
    } catch (error: any) {
      return { ok: false, message: error?.message ?? "Could not create or join the subject group right now." };
    }

    redirect(`/groups?group=${encodeURIComponent(String(groupId))}`);
  }

  const { data: groups } = await firebase
    .from("groups")
    .select("id")
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject);

  const groupIds = (groups ?? []).map((row: any) => String(row?.id ?? "").trim()).filter(Boolean);
  if (groupIds.length) {
    const { error: leaveErr } = await firebase.from("group_members").delete().eq("user_id", user.id).in("group_id", groupIds);
    if (leaveErr) return { ok: false, message: leaveErr.message };
  }

  redirect("/settings");
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

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const whatsappOptIn = formData.get("whatsapp_opt_in") === "on";
  const whatsappTemplateRaw = String(formData.get("whatsapp_template") ?? "coach").trim().toLowerCase();
  const whatsappTemplate = ["coach", "countdown", "streak"].includes(whatsappTemplateRaw)
    ? whatsappTemplateRaw
    : "coach";

  const primary = reminders[0] as { time: string; channel: string } | undefined;
  const { error } = await firebase.from("notification_prefs").upsert({
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

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  let inserted = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomBytes(18).toString("base64url");
    const { error } = await firebase.from("parent_links").insert({
      token,
      user_id: user.id,
      label,
      revoked_at: null,
      last_viewed_at: null
    });
    if (!error) {
      inserted = true;
      break;
    }
  }
  if (!inserted) return { ok: false, message: "Could not create parent link right now. Please try again." };

  revalidatePath("/settings");
  redirect("/settings");
}

