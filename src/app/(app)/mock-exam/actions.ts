"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { createQuizWithQuestions } from "@/lib/quizzes/create-quiz";

const Schema = z.object({
  question_count: z.coerce.number().int().min(10).max(100).default(40),
  duration_min: z.coerce.number().int().min(5).max(180).default(60),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
});

export async function startMockExamAction(_: unknown, formData: FormData) {
  const parsed = Schema.safeParse({
    question_count: formData.get("question_count") ?? 40,
    duration_min: formData.get("duration_min") ?? 60,
    difficulty: formData.get("difficulty") ?? "medium"
  });
  if (!parsed.success) return { ok: false, message: "Invalid mock exam settings." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const plan = await getActivePlanForUser(user.id);
  if (!plan) return { ok: false, message: "No active plan." };

  const { data: exam } = await supabase.from("exams").select("name").eq("id", plan.exam_id).maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_explanation_language")
    .eq("user_id", user.id)
    .maybeSingle();

  const quizId = await createQuizWithQuestions({
    userId: user.id,
    examId: plan.exam_id,
    examName: exam?.name ?? "Exam",
    subject: plan.subject,
    topicPath: `Mock exam: ${plan.subject}`,
    quizType: "mock",
    difficulty: parsed.data.difficulty,
    questionCount: parsed.data.question_count,
    preferredLanguage: profile?.preferred_explanation_language ?? "en",
    meta: {
      duration_sec: parsed.data.duration_min * 60,
      question_count: parsed.data.question_count
    }
  });

  redirect(`/mock-exam/${quizId}`);
}
