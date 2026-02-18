import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";

export async function matchOrCreateGroup(args: {
  userId: string;
  examId: string;
  subject: string;
  pace: "steady" | "intensive";
  level: string;
  timezone: string;
  groupName?: string;
}) {
  const firebase = await createFirebaseServerClient();

  const { data: groups } = await firebase
    .from("groups")
    .select("id")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .eq("pace", args.pace)
    .eq("level", args.level)
    .eq("timezone", args.timezone)
    .order("created_at", { ascending: false })
    .limit(10);

  let pickedGroupId: string | null = groups?.[0]?.id ?? null;

  if (pickedGroupId) {
    const { count } = await firebase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", pickedGroupId);
    if ((count ?? 0) >= 15) pickedGroupId = null;
  }

  if (!pickedGroupId) {
    const { data: created, error: createErr } = await firebase
      .from("groups")
      .insert({
        exam_id: args.examId,
        subject: args.subject,
        pace: args.pace,
        level: args.level,
        timezone: args.timezone,
        name: args.groupName ?? `${args.subject} group`
      })
      .select("id")
      .single();
    if (createErr) throw createErr;
    pickedGroupId = created.id;
  }

  await firebase.from("group_members").upsert(
    {
      group_id: pickedGroupId,
      user_id: args.userId,
      role: "member"
    },
    { onConflict: "group_id,user_id" }
  );

  return pickedGroupId;
}
