"use server";

import { z } from "zod";
import { submitQuiz } from "@/lib/quizzes/submit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SubmitSchema = z.object({
  quiz_id: z.string().uuid(),
  answers: z
    .array(z.number().int().min(0).max(3))
    .min(1)
    .max(50)
});

export async function submitQuizAction(_: unknown, formData: FormData) {
  const rawAnswers = formData.get("answers");
  const parsed = SubmitSchema.safeParse({
    quiz_id: formData.get("quiz_id"),
    answers: typeof rawAnswers === "string" ? JSON.parse(rawAnswers) : []
  });
  if (!parsed.success) return { ok: false, message: "Invalid submission." };

  // Server Action remains for progressive enhancement; API route powers offline sync.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const res = await submitQuiz({ userId: user.id, quizId: parsed.data.quiz_id, answers: parsed.data.answers });
  return res;
}
