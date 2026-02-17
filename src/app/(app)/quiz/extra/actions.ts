"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { createQuizWithQuestions } from "@/lib/quizzes/create-quiz";

const Schema = z.object({
  topic_path: z.string().min(1).max(200),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
});

export async function createExtraQuizAction(_: unknown, formData: FormData) {
  const parsed = Schema.safeParse({
    topic_path: formData.get("topic_path"),
    difficulty: formData.get("difficulty") ?? "medium"
  });
  if (!parsed.success) return { ok: false, message: "Pick a topic." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const plan = await getActivePlanForUser(user.id);
  if (!plan) return { ok: false, message: "No active plan." };

  const { data: exam } = await firebase.from("exams").select("name").eq("id", plan.exam_id).maybeSingle();
  const { data: profile } = await firebase
    .from("profiles")
    .select("preferred_explanation_language")
    .eq("user_id", user.id)
    .maybeSingle();

  const quizId = await createQuizWithQuestions({
    userId: user.id,
    examId: plan.exam_id,
    examName: exam?.name ?? "Exam",
    subject: plan.subject,
    topicPath: parsed.data.topic_path,
    quizType: "extra",
    difficulty: parsed.data.difficulty,
    questionCount: 10,
    preferredLanguage: profile?.preferred_explanation_language ?? "en",
    meta: { source: "weak_area" }
  });

  redirect(`/quiz/${quizId}`);
}
