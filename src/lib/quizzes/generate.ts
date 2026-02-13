import "server-only";

import { startOfDay } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateQuestions } from "@/lib/quizzes/questions";

export async function getOrCreateDailyQuiz(args: {
  userId: string;
  examId: string;
  examName: string;
  subject: string;
  topicPath: string;
  difficulty?: "easy" | "medium" | "hard";
  preferredLanguage?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const difficulty = args.difficulty ?? "medium";
  const dayStart = startOfDay(new Date()).toISOString();

  const { data: existing } = await supabase
    .from("quizzes")
    .select("id")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .eq("topic_path", args.topicPath)
    .eq("quiz_type", "daily")
    .eq("created_by", args.userId)
    .gte("created_at", dayStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      exam_id: args.examId,
      subject: args.subject,
      topic_path: args.topicPath,
      quiz_type: "daily",
      difficulty,
      created_by: args.userId,
      meta: {
        preferred_language: args.preferredLanguage ?? "en"
      }
    })
    .select("id")
    .single();
  if (quizErr) throw quizErr;

  const questions = await generateQuestions({
    examName: args.examName,
    subject: args.subject,
    topic: args.topicPath,
    count: 8,
    preferredLanguage: args.preferredLanguage ?? null
  });

  const { error: qErr } = await supabase.from("quiz_questions").insert(
    questions.map((q) => ({
      quiz_id: quiz.id,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation
    }))
  );
  if (qErr) throw qErr;

  return quiz.id;
}
