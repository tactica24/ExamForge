import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";
import { generateQuestions } from "@/lib/quizzes/questions";

export async function createQuizWithQuestions(args: {
  userId: string;
  examId: string;
  examName: string;
  subject: string;
  topicPath: string;
  quizType: "daily" | "extra" | "group" | "mock";
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  preferredLanguage?: string | null;
  meta?: Record<string, any>;
}) {
  const firebase = await createFirebaseServerClient();

  const { data: quiz, error: quizErr } = await firebase
    .from("quizzes")
    .insert({
      exam_id: args.examId,
      subject: args.subject,
      topic_path: args.topicPath,
      quiz_type: args.quizType,
      difficulty: args.difficulty,
      created_by: args.userId,
      meta: { ...(args.meta ?? {}), preferred_language: args.preferredLanguage ?? "en" }
    })
    .select("id")
    .single();
  if (quizErr) throw quizErr;

  const questions = await generateQuestions({
    examName: args.examName,
    subject: args.subject,
    topic: args.topicPath,
    count: args.questionCount,
    preferredLanguage: args.preferredLanguage ?? null
  });

  const { error: qErr } = await firebase.from("quiz_questions").insert(
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
