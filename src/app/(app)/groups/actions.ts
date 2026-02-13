"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { simpleModerate } from "@/lib/moderation/simple";

const SendSchema = z.object({
  group_id: z.string().uuid(),
  content: z.string().min(1).max(2000)
});

export async function sendGroupMessageAction(_: unknown, formData: FormData) {
  const parsed = SendSchema.safeParse({
    group_id: formData.get("group_id"),
    content: formData.get("content")
  });
  if (!parsed.success) return { ok: false, message: "Message is required." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const mod = simpleModerate(parsed.data.content);
  if (!mod.ok) return { ok: false, message: "Message too long." };

  const { error } = await supabase.from("group_messages").insert({
    group_id: parsed.data.group_id,
    user_id: user.id,
    content: parsed.data.content.trim(),
    flagged: mod.flagged
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

