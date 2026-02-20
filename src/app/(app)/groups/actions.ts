"use server";

import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { redirect } from "next/navigation";
import { simpleModerate } from "@/lib/moderation/simple";

const SendSchema = z.object({
  group_id: z.string().uuid(),
  content: z.string().min(1).max(2000)
});

const JoinSchema = z.object({
  exam_id: z.string().min(3),
  subject: z.string().min(2).max(120),
  group_name: z.string().trim().max(40).optional()
});

const LeaveSchema = z.object({
  group_id: z.string().uuid()
});

const RenameSchema = z.object({
  group_id: z.string().uuid(),
  name: z.string().trim().min(2).max(40)
});

const DeleteSchema = z.object({
  group_id: z.string().uuid()
});

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function sendGroupMessageAction(_: unknown, formData: FormData) {
  const parsed = SendSchema.safeParse({
    group_id: formData.get("group_id"),
    content: formData.get("content")
  });
  if (!parsed.success) return { ok: false, message: "Message is required." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const mod = simpleModerate(parsed.data.content);
  if (!mod.ok) return { ok: false, message: "Message too long." };

  const { error } = await firebase.from("group_messages").insert({
    group_id: parsed.data.group_id,
    user_id: user.id,
    content: parsed.data.content.trim(),
    flagged: mod.flagged
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function joinSubjectGroupAction(_: unknown, formData: FormData) {
  const parsed = JoinSchema.safeParse({
    exam_id: formData.get("exam_id"),
    subject: formData.get("subject"),
    group_name: (formData.get("group_name") as string | null) || undefined
  });
  if (!parsed.success) return { ok: false, message: "Select a valid subject group." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { count: existingCount } = await firebase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((existingCount ?? 0) >= 3) {
    return { ok: false, message: "You can join up to 3 groups." };
  }

  const { data: profile } = await firebase
    .from("profiles")
    .select("level,timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: groups } = await firebase
    .from("groups")
    .select("id")
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject)
    .order("created_at", { ascending: false })
    .limit(10);

  let pickedGroupId: string | null = null;
  const candidateIds = (groups ?? []).map((group) => String((group as any).id ?? "").trim()).filter(Boolean);
  const groupMemberCounts = new Map<string, number>(candidateIds.map((id) => [id, 0]));

  for (const batch of chunk(candidateIds, 30)) {
    const { data: members } = await firebase.from("group_members").select("group_id").in("group_id", batch);
    for (const member of members ?? []) {
      const groupId = String((member as any).group_id ?? "").trim();
      if (!groupId) continue;
      groupMemberCounts.set(groupId, (groupMemberCounts.get(groupId) ?? 0) + 1);
    }
  }

  for (const group of groups ?? []) {
    const groupId = String((group as any).id ?? "").trim();
    if (!groupId) continue;
    if ((groupMemberCounts.get(groupId) ?? 0) < 15) {
      pickedGroupId = groupId;
      break;
    }
  }

  if (!pickedGroupId) {
    const { data: created, error: createErr } = await firebase
      .from("groups")
      .insert({
        exam_id: parsed.data.exam_id,
        subject: parsed.data.subject,
        pace: "steady",
        level: profile?.level ?? "beginner",
        timezone: profile?.timezone ?? "Africa/Lagos",
        name: parsed.data.group_name ?? `${parsed.data.subject} group`
      })
      .select("id")
      .single();
    if (createErr) return { ok: false, message: createErr.message };
    pickedGroupId = created.id;
  }

  const { error } = await firebase.from("group_members").upsert(
    {
      group_id: pickedGroupId,
      user_id: user.id,
      role: "member"
    },
    { onConflict: "group_id,user_id" }
  );
  if (error) return { ok: false, message: error.message };

  redirect(`/groups/${pickedGroupId}`);
}

export async function leaveGroupAction(_: unknown, formData: FormData) {
  const parsed = LeaveSchema.safeParse({
    group_id: formData.get("group_id")
  });
  if (!parsed.success) return { ok: false, message: "Invalid group." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { error } = await firebase
    .from("group_members")
    .delete()
    .eq("group_id", parsed.data.group_id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  const { count } = await firebase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", parsed.data.group_id);
  if ((count ?? 0) === 0) {
    await firebase.from("groups").delete().eq("id", parsed.data.group_id);
  }

  redirect("/groups");
}

export async function renameGroupAction(_: unknown, formData: FormData) {
  const parsed = RenameSchema.safeParse({
    group_id: formData.get("group_id"),
    name: formData.get("name")
  });
  if (!parsed.success) return { ok: false, message: "Group name must be 2-40 characters." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: membership } = await firebase
    .from("group_members")
    .select("group_id")
    .eq("group_id", parsed.data.group_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, message: "You are not a member of this group." };

  const { error } = await firebase.from("groups").update({ name: parsed.data.name }).eq("id", parsed.data.group_id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteGroupAction(_: unknown, formData: FormData) {
  const parsed = DeleteSchema.safeParse({
    group_id: formData.get("group_id")
  });
  if (!parsed.success) return { ok: false, message: "Invalid group." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: membership } = await firebase
    .from("group_members")
    .select("role")
    .eq("group_id", parsed.data.group_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, message: "You are not a member of this group." };

  const { count } = await firebase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", parsed.data.group_id);
  if ((count ?? 0) > 1 && membership.role !== "moderator") {
    return { ok: false, message: "Only a group moderator can delete a group with members." };
  }

  await firebase.from("group_messages").delete().eq("group_id", parsed.data.group_id);
  await firebase.from("group_members").delete().eq("group_id", parsed.data.group_id);
  await firebase.from("groups").delete().eq("id", parsed.data.group_id);

  redirect("/groups");
}
