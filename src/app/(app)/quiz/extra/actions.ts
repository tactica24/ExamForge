"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { createQuizWithQuestions } from "@/lib/quizzes/create-quiz";

const Schema = z.object({
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subject: z.string().min(2).max(120),
  topic_path: z.string().max(200).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
});

export async function createExtraQuizAction(_: unknown, formData: FormData) {
  const parsed = Schema.safeParse({
    exam_id: formData.get("exam_id"),
    exam_slug: formData.get("exam_slug"),
    subject: formData.get("subject"),
    topic_path: formData.get("topic_path") ?? undefined,
    difficulty: formData.get("difficulty") ?? "medium"
  });
  if (!parsed.success) return { ok: false, message: "Pick a topic." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: exam } = await firebase
    .from("exams")
    .select("name,slug")
    .eq("id", parsed.data.exam_id)
    .maybeSingle();
  const { data: profile } = await firebase
    .from("profiles")
    .select("preferred_explanation_language")
    .eq("user_id", user.id)
    .maybeSingle();

  const quizId = await createQuizWithQuestions({
    userId: user.id,
    examId: parsed.data.exam_id,
    examName: exam?.name ?? "Exam",
    examSlug: exam?.slug ?? parsed.data.exam_slug,
    subject: parsed.data.subject,
    topicPath: parsed.data.topic_path?.trim() ? parsed.data.topic_path.trim() : `Practice: ${parsed.data.subject}`,
    quizType: "extra",
    difficulty: parsed.data.difficulty,
    questionCount: 10,
    preferredLanguage: profile?.preferred_explanation_language ?? "en",
    meta: { source: "weak_area" }
  });

  redirect(`/quiz/${quizId}`);
}
