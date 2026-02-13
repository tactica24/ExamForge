import "server-only";

import { startOfDay } from "date-fns";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateGamificationAfterQuiz } from "@/lib/gamification/update-after-quiz";
import { updateWeakAreasAfterQuiz } from "@/lib/personalization/weak-areas";
import { syncProfilePublic } from "@/lib/profile/public";

const SubmitSchema = z.object({
  quiz_id: z.string().uuid(),
  answers: z.array(z.number().int().min(0).max(3)).min(1).max(200)
});

export async function submitQuiz(args: { userId: string; quizId: string; answers: number[] }) {
  const parsed = SubmitSchema.safeParse({ quiz_id: args.quizId, answers: args.answers });
  if (!parsed.success) return { ok: false as const, message: "Invalid submission." };

  const supabase = await createSupabaseServerClient();

  const dayStart = startOfDay(new Date()).toISOString();
  const { data: existing } = await supabase
    .from("user_quiz_results")
    .select("id,score,total,created_at")
    .eq("user_id", args.userId)
    .eq("quiz_id", args.quizId)
    .gte("created_at", dayStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: true as const, score: existing.score, total: existing.total, duplicate: true as const };
  }

  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .select("id,exam_id,subject,topic_path,quiz_type,meta")
    .eq("id", args.quizId)
    .maybeSingle();
  if (quizErr || !quiz) return { ok: false as const, message: quizErr?.message ?? "Quiz not found." };

  const { data: qs, error: qErr } = await supabase
    .from("quiz_questions")
    .select("id,correct_index")
    .eq("quiz_id", args.quizId)
    .order("id", { ascending: true });
  if (qErr) return { ok: false as const, message: qErr.message };

  const correct = (qs ?? []).map((q) => q.correct_index);
  const total = correct.length;
  const score = correct.reduce((acc, ci, idx) => acc + (args.answers[idx] === ci ? 1 : 0), 0);

  const { error } = await supabase.from("user_quiz_results").insert({
    user_id: args.userId,
    quiz_id: args.quizId,
    score,
    total,
    answers: args.answers
  });
  if (error) return { ok: false as const, message: error.message };

  await syncProfilePublic({ userId: args.userId }).catch(() => {});

  const weak = await updateWeakAreasAfterQuiz({
    userId: args.userId,
    examId: quiz.exam_id,
    subject: quiz.subject,
    topicPath: quiz.topic_path,
    score,
    total
  }).catch(() => null);

  const gamification = await updateGamificationAfterQuiz({
    supabase,
    userId: args.userId,
    score,
    total,
    quizId: args.quizId,
    topicPath: quiz.topic_path
  });

  // Peer help suggestion: if weak and user is in a group for this exam/subject, post a prompt.
  if ((weak as any)?.isWeak) {
    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id,groups!inner(exam_id,subject)")
      .eq("user_id", args.userId)
      .eq("groups.exam_id", quiz.exam_id as any)
      .eq("groups.subject", quiz.subject as any)
      .limit(1)
      .maybeSingle();

    if (membership?.group_id) {
      await supabase.from("group_messages").insert({
        group_id: membership.group_id,
        user_id: args.userId,
        content: `I scored low on "${quiz.topic_path}". Who can explain it in simple terms?`,
        flagged: false,
        is_system: false
      });
    }
  }

  return {
    ok: true as const,
    score,
    total,
    percent: total ? Math.round((score / total) * 100) : 0,
    weak: weak ?? undefined,
    gamification
  };
}
