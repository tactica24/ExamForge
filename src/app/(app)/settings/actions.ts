"use server";

import { formatISO } from "date-fns";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { syncProfilePublic } from "@/lib/profile/public";
import { redirect } from "next/navigation";
import { ensureSeedExamExists } from "@/lib/seed/ensure";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";
import { generatePlanItemsFromTopics } from "@/lib/plans/generate";

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
  preferred_explanation_language: z.enum(["en", "pidgin", "hausa", "yoruba", "igbo"]).default("en"),
  low_data_mode: z.coerce.boolean().default(false),
  leaderboard_anonymous: z.coerce.boolean().default(false)
});

export async function updateProfileAction(_: unknown, formData: FormData) {
  const parsed = ProfileSchema.safeParse({
    name: formData.get("name"),
    display_name: (formData.get("display_name") as string | null) || undefined,
    avatar_url: (formData.get("avatar_url") as string | null)?.trim() || undefined,
    location: (formData.get("location") as string | null) || undefined,
    timezone: formData.get("timezone"),
    learning_style: formData.get("learning_style"),
    level: formData.get("level"),
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

  const { error } = await firebase.from("profiles").update(parsed.data).eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };
  await syncProfilePublic({ userId: user.id }).catch(() => {});
  return { ok: true };
}

const AddExamSubjectSchema = z.object({
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subject: z.string().trim().min(2).max(120)
});

async function ensurePlanForSubject(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  examId: string;
  examSlug: string;
  subject: string;
}) {
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
  const pace = (templatePlan?.pace as "steady" | "intensive" | undefined) ?? "steady";
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

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

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

  const { error } = await firebase.from("user_exam_subjects").upsert(
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
    firebase,
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

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const primary = reminders[0] as { time: string; channel: string } | undefined;
  const { error } = await firebase.from("notification_prefs").upsert({
    user_id: user.id,
    reminder_time: primary?.time ?? "19:00",
    channels: primary ? [primary.channel] : ["in_app"],
    reminders
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

  const { data, error } = await firebase
    .from("parent_links")
    .insert({ user_id: user.id, label })
    .select("token")
    .single();
  if (error) return { ok: false, message: error.message };

  redirect("/settings");
}
