"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ProfileSchema = z.object({
  name: z.string().min(2).max(60),
  location: z.string().max(80).optional(),
  timezone: z.string().min(2).max(60),
  learning_style: z.string().min(2).max(30),
  level: z.enum(["beginner", "intermediate", "advanced"])
});

export async function updateProfileAction(_: unknown, formData: FormData) {
  const parsed = ProfileSchema.safeParse({
    name: formData.get("name"),
    location: (formData.get("location") as string | null) || undefined,
    timezone: formData.get("timezone"),
    learning_style: formData.get("learning_style"),
    level: formData.get("level")
  });
  if (!parsed.success) return { ok: false, message: "Invalid profile fields." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
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

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { error } = await supabase.from("notification_prefs").upsert({
    user_id: user.id,
    reminder_time: parsed.data.reminder_time,
    channels: [parsed.data.channels]
  });
  if (error) return { ok: false, message: error.message };

  return { ok: true };
}

