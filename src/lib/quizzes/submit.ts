import "server-only";

import { startOfDay } from "date-fns";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { updateGamificationAfterQuiz } from "@/lib/gamification/update-after-quiz";
import { updateWeakAreasAfterQuiz } from "@/lib/personalization/weak-areas";
import { syncProfilePublic } from "@/lib/profile/public";
import { getPlanItemProgress, withPlanItemProgress } from "@/lib/plans/content";
import type { Json } from "@/lib/firebase/database.types";

const SubmitSchema = z.object({
  quiz_id: z.string().uuid(),
  answers: z.array(z.number().int().min(0).max(3)).min(1).max(200)
});

function toCreatedAtMs(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export async function submitQuiz(args: { userId: string; quizId: string; answers: number[] }) {
  const parsed = SubmitSchema.safeParse({ quiz_id: args.quizId, answers: args.answers });
  if (!parsed.success) return { ok: false as const, message: "Invalid submission." };

  const firebase = await createFirebaseServerClient();

  const { data: quiz, error: quizErr } = await firebase
    .from("quizzes")
    .select("id,created_by,exam_id,subject,topic_path,quiz_type,meta")
    .eq("id", args.quizId)
    .maybeSingle();
  if (quizErr || !quiz) return { ok: false as const, message: quizErr?.message ?? "Quiz not found." };
  if (String(quiz.created_by ?? "") !== args.userId) {
    return { ok: false as const, message: "Quiz not found." };
  }

  const dayStart = startOfDay(new Date()).toISOString();
  const { data: existingResults } = await firebase
    .from("user_quiz_results")
    .select("id,score,total,created_at")
    .eq("user_id", args.userId)
    .eq("quiz_id", args.quizId)
    .gte("created_at", dayStart);
  const existing =
    [...(existingResults ?? [])].sort((left, right) => toCreatedAtMs(right.created_at) - toCreatedAtMs(left.created_at))[0] ??
    null;

  if (existing) {
    const completion = await syncPlanTopicCompletion({
      firebase,
      userId: args.userId,
      quizId: args.quizId,
      quizMeta: quiz.meta
    });
    if (!completion.ok) return completion;
    return { ok: true as const, score: existing.score, total: existing.total, duplicate: true as const };
  }

  const { data: qs, error: qErr } = await firebase
    .from("quiz_questions")
    .select("id,correct_index")
    .eq("quiz_id", args.quizId);
  if (qErr) return { ok: false as const, message: qErr.message };

  const correct = [...(qs ?? [])]
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .map((q) => q.correct_index);
  const total = correct.length;
  const score = correct.reduce((acc, ci, idx) => acc + (args.answers[idx] === ci ? 1 : 0), 0);

  const { error } = await firebase.from("user_quiz_results").insert({
    user_id: args.userId,
    quiz_id: args.quizId,
    score,
    total,
    answers: args.answers
  });
  if (error) return { ok: false as const, message: error.message };

  const completion = await syncPlanTopicCompletion({
    firebase,
    userId: args.userId,
    quizId: args.quizId,
    quizMeta: quiz.meta
  });
  if (!completion.ok) return completion;

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
    firebase,
    userId: args.userId,
    score,
    total,
    quizId: args.quizId,
    topicPath: quiz.topic_path
  });

  // Peer help suggestion: if weak and user is in a group for this exam/subject, post a prompt.
  if ((weak as any)?.isWeak) {
    const { data: membership } = await firebase
      .from("group_members")
      .select("group_id,groups!inner(exam_id,subject)")
      .eq("user_id", args.userId)
      .eq("groups.exam_id", quiz.exam_id as any)
      .eq("groups.subject", quiz.subject as any)
      .limit(1)
      .maybeSingle();

    if (membership?.group_id) {
      await firebase.from("group_messages").insert({
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

async function syncPlanTopicCompletion(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  quizId: string;
  quizMeta: unknown;
}) {
  const meta = (args.quizMeta ?? {}) as Record<string, any>;
  const planItemId = String(meta.plan_item_id ?? "").trim();
  if (!planItemId) return { ok: true as const };

  const { data: planItem } = await args.firebase
    .from("plan_items")
    .select("id,plan_id,status,resource_links")
    .eq("id", planItemId)
    .maybeSingle();

  if (!planItem?.id) {
    return { ok: false as const, message: "Linked study-plan topic was not found." };
  }

  const { data: ownedPlan } = await args.firebase
    .from("user_plans")
    .select("id")
    .eq("id", planItem.plan_id)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (!ownedPlan) {
    return { ok: false as const, message: "Quiz not found." };
  }

  const progress = getPlanItemProgress(planItem.resource_links);
  const nextProgress = {
    quiz: {
      completed: true,
      completed_at: new Date().toISOString(),
      last_quiz_id: args.quizId,
      attempts: Math.max(progress.quiz.attempts, Number(meta.plan_item_attempt ?? 0), 1)
    }
  };

  const nextLinks = withPlanItemProgress(planItem.resource_links, nextProgress);
  const { error } = await args.firebase
    .from("plan_items")
    .update({
      status: "done",
      resource_links: nextLinks as Json
    })
    .eq("id", planItemId);

  if (error) {
    return { ok: false as const, message: "Quiz was submitted, but the study-plan topic could not be updated." };
  }

  return { ok: true as const };
}
