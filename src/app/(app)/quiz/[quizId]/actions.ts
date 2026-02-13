"use server";

import { z } from "zod";
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

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: qs, error: qErr } = await supabase
    .from("quiz_questions")
    .select("correct_index")
    .eq("quiz_id", parsed.data.quiz_id)
    .order("id", { ascending: true });
  if (qErr) return { ok: false, message: qErr.message };

  const correct = (qs ?? []).map((q) => q.correct_index);
  const total = correct.length;
  const score = correct.reduce((acc, ci, idx) => acc + (parsed.data.answers[idx] === ci ? 1 : 0), 0);

  const { error } = await supabase.from("user_quiz_results").insert({
    user_id: user.id,
    quiz_id: parsed.data.quiz_id,
    score,
    total,
    answers: parsed.data.answers
  });
  if (error) return { ok: false, message: error.message };

  return { ok: true, score, total };
}

