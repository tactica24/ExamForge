import "server-only";

import { addDays, formatISO } from "date-fns";
import type { Json } from "@/lib/firebase/database.types";
import { createFirebaseServerClient } from "@/lib/firebase/server";

type WeakArea = {
  score: number; // percent 0..100
  last_attempt: string; // YYYY-MM-DD
  last_improved: string | null; // YYYY-MM-DD
};

function safeWeakAreas(value: any): Record<string, WeakArea> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, WeakArea>;
}

export async function updateWeakAreasAfterQuiz(args: {
  userId: string;
  examId: string;
  subject: string;
  topicPath: string;
  score: number;
  total: number;
}) {
  const firebase = await createFirebaseServerClient();

  const percent = args.total ? Math.round((args.score / args.total) * 100) : 0;
  const today = formatISO(new Date(), { representation: "date" });

  const { data: plan } = await firebase
    .from("user_plans")
    .select("*")
    .eq("user_id", args.userId)
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!plan) return { ok: false as const, percent };

  const current = safeWeakAreas(plan.weak_areas);
  const prev = current[args.topicPath];

  const improved = prev ? percent > prev.score : percent >= 60;
  const next: Record<string, WeakArea> = {
    ...current,
    [args.topicPath]: {
      score: percent,
      last_attempt: today,
      last_improved: improved ? today : prev?.last_improved ?? null
    }
  };

  await firebase.from("user_plans").update({ weak_areas: next as unknown as Json }).eq("id", plan.id);

  const isWeak = percent < 60;
  if (isWeak) {
    const tomorrow = formatISO(addDays(new Date(), 1), { representation: "date" });
    await firebase.from("plan_items").insert({
      plan_id: plan.id,
      scheduled_for: tomorrow,
      day_index: 9999,
      topic_path: args.topicPath,
      title: `Weak-area drill: ${args.topicPath}`,
      resource_links: [],
      status: "todo"
    });
  }

  return { ok: true as const, percent, isWeak };
}
