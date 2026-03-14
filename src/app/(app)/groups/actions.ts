"use server";

import { z } from "zod";
import { createBackendServerClient } from "@/lib/backend/server";
import { redirect } from "next/navigation";
import { simpleModerate } from "@/lib/moderation/simple";

const SendSchema = z.object({
  group_id: z.string().uuid(),
  content: z.string().min(1).max(2000)
});

const LeaveSchema = z.object({
  group_id: z.string().uuid()
});

export async function sendGroupMessageAction(_: unknown, formData: FormData) {
  const parsed = SendSchema.safeParse({
    group_id: formData.get("group_id"),
    content: formData.get("content")
  });
  if (!parsed.success) return { ok: false, message: "Message is required." };

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: membership } = await backend
    .from("group_members")
    .select("group_id")
    .eq("group_id", parsed.data.group_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, message: "Group access denied." };

  const content = parsed.data.content.trim();
  const mod = simpleModerate(content);
  if (!mod.ok) return { ok: false, message: "Message too long." };

  const { error } = await backend.from("group_messages").insert({
    group_id: parsed.data.group_id,
    user_id: user.id,
    content,
    flagged: mod.flagged
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function leaveGroupAction(_: unknown, formData: FormData) {
  const parsed = LeaveSchema.safeParse({
    group_id: formData.get("group_id")
  });
  if (!parsed.success) return { ok: false, message: "Invalid group." };

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: membership } = await backend
    .from("group_members")
    .select("group_id")
    .eq("group_id", parsed.data.group_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, message: "This group is no longer in your dashboard." };

  const { error } = await backend
    .from("group_members")
    .delete()
    .eq("group_id", parsed.data.group_id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  redirect("/groups");
}
