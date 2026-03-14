"use server";

import { z } from "zod";
import { createBackendServerClient } from "@/lib/backend/server";
import { submitQuiz } from "@/lib/quizzes/submit";

const SubmitSchema = z.object({
  quiz_id: z.string().uuid(),
  answers: z
    .array(z.number().int().min(0).max(3))
    .min(1)
    .max(50)
});

export async function submitQuizAction(_: unknown, formData: FormData) {
  const rawAnswers = formData.get("answers");
  let parsedAnswers: unknown[] = [];
  if (typeof rawAnswers === "string") {
    try {
      parsedAnswers = JSON.parse(rawAnswers);
    } catch {
      parsedAnswers = [];
    }
  }

  const parsed = SubmitSchema.safeParse({
    quiz_id: formData.get("quiz_id"),
    answers: parsedAnswers
  });
  if (!parsed.success) return { ok: false, message: "Invalid submission." };

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const result = await submitQuiz({
    userId: user.id,
    quizId: parsed.data.quiz_id,
    answers: parsed.data.answers
  });

  if (!result.ok) return result;
  return { ok: true, score: result.score, total: result.total };
}


