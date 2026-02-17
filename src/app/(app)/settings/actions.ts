"use server";

import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { syncProfilePublic } from "@/lib/profile/public";
import { redirect } from "next/navigation";

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
  subject: z.string().trim().min(2).max(120)
});

export async function addExamSubjectAction(_: unknown, formData: FormData) {
  const raw = String(formData.get("exam_subject") ?? "").trim();
  const separator = "::";
  const splitIndex = raw.indexOf(separator);

  if (splitIndex <= 0) {
    return { ok: false, message: "Select an exam and subject." };
  }

  const parsed = AddExamSubjectSchema.safeParse({
    exam_id: raw.slice(0, splitIndex),
    subject: raw.slice(splitIndex + separator.length)
  });

  if (!parsed.success) return { ok: false, message: "Invalid exam subject selection." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { error } = await firebase.from("user_exam_subjects").upsert(
    {
      user_id: user.id,
      exam_id: parsed.data.exam_id,
      subject: parsed.data.subject,
      is_active: true
    },
    { onConflict: "user_id,exam_id,subject" }
  );

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Subject added successfully." };
}

const PrefsSchema = z.object({
  reminder_time: z.string().regex(/^\d{2}:\d{2}$/),
  channels: z.enum(["in_app", "sms", "whatsapp", "email"])
});

export async function updateNotificationPrefsAction(_: unknown, formData: FormData) {
  const parsed = PrefsSchema.safeParse({
    reminder_time: formData.get("reminder_time"),
    channels: formData.get("channel")
  });
  if (!parsed.success) return { ok: false, message: "Invalid notification preferences." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { error } = await firebase.from("notification_prefs").upsert({
    user_id: user.id,
    reminder_time: parsed.data.reminder_time,
    channels: [parsed.data.channels]
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
