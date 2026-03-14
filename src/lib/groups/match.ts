import "server-only";

import { createBackendServerClient } from "@/lib/backend/server";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function formatGroupName(subject: string, groupNumber: number) {
  return `${subject} Group ${groupNumber}`;
}

export async function matchOrCreateGroup(args: {
  userId: string;
  examId: string;
  subject: string;
  pace: string;
  level: string;
  timezone: string;
  groupName?: string;
}) {
  const backend = await createBackendServerClient();

  const { data: groups } = await backend
    .from("groups")
    .select("id")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .eq("pace", args.pace)
    .eq("level", args.level)
    .eq("timezone", args.timezone)
    .order("created_at", { ascending: false })
    .limit(10);

  const candidateIds = (groups ?? []).map((group) => String((group as any).id ?? "").trim()).filter(Boolean);
  const groupMemberCounts = new Map<string, number>(candidateIds.map((id) => [id, 0]));

  for (const batch of chunk(candidateIds, 30)) {
    const { data: members } = await backend.from("group_members").select("group_id").in("group_id", batch);
    for (const member of members ?? []) {
      const groupId = String((member as any).group_id ?? "").trim();
      if (!groupId) continue;
      groupMemberCounts.set(groupId, (groupMemberCounts.get(groupId) ?? 0) + 1);
    }
  }

  let pickedGroupId: string | null = null;
  for (const group of groups ?? []) {
    const groupId = String((group as any).id ?? "").trim();
    if (!groupId) continue;
    if ((groupMemberCounts.get(groupId) ?? 0) < 15) {
      pickedGroupId = groupId;
      break;
    }
  }

  if (!pickedGroupId) {
    const { count: existingGroupCount } = await backend
      .from("groups")
      .select("*", { count: "exact", head: true })
      .eq("exam_id", args.examId)
      .eq("subject", args.subject)
      .eq("pace", args.pace)
      .eq("level", args.level)
      .eq("timezone", args.timezone);

    const { data: created, error: createErr } = await backend
      .from("groups")
      .insert({
        exam_id: args.examId,
        subject: args.subject,
        pace: args.pace,
        level: args.level,
        timezone: args.timezone,
        name: args.groupName ?? formatGroupName(args.subject, (existingGroupCount ?? 0) + 1)
      })
      .select("id")
      .single();
    if (createErr) throw createErr;
    pickedGroupId = created.id;
  }

  await backend.from("group_members").upsert(
    {
      group_id: pickedGroupId,
      user_id: args.userId,
      role: "member"
    },
    { onConflict: "group_id,user_id" }
  );

  return pickedGroupId;
}

