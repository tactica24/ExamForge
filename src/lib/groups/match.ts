import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function matchOrCreateGroup(args: {
  userId: string;
  examId: string;
  subject: string;
  pace: "steady" | "intensive";
  level: string;
  timezone: string;
}) {
  const supabase = createSupabaseServerClient();

  const { data: groups } = await supabase
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
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", pickedGroupId);
    if ((count ?? 0) >= 10) pickedGroupId = null;
  }

  if (!pickedGroupId) {
    const { data: created, error: createErr } = await supabase
      .from("groups")
      .insert({
        exam_id: args.examId,
        subject: args.subject,
        pace: args.pace,
        level: args.level,
        timezone: args.timezone
      })
      .select("id")
      .single();
    if (createErr) throw createErr;
    pickedGroupId = created.id;
  }

  await supabase.from("group_members").upsert(
    {
      group_id: pickedGroupId,
      user_id: args.userId,
      role: "member"
    },
    { onConflict: "group_id,user_id" }
  );

  return pickedGroupId;
}

