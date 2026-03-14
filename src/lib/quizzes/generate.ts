import "server-only";

import { startOfDay } from "date-fns";
import { createBackendServerClient } from "@/lib/backend/server";
import { createQuizWithQuestions } from "@/lib/quizzes/create-quiz";

export async function getOrCreateDailyQuiz(args: {
  userId: string;
  examId: string;
  examName: string;
  examSlug?: string;
  subject: string;
  topicPath: string;
  difficulty?: "easy" | "medium" | "hard";
  preferredLanguage?: string | null;
}) {
  const backend = await createBackendServerClient();
  const difficulty = args.difficulty ?? "medium";
  const dayStart = startOfDay(new Date()).toISOString();

  const { data: existing } = await backend
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

  return createQuizWithQuestions({
    userId: args.userId,
    examId: args.examId,
    examName: args.examName,
    examSlug: args.examSlug,
    subject: args.subject,
    topicPath: args.topicPath,
    quizType: "daily",
    difficulty,
    questionCount: 8,
    preferredLanguage: args.preferredLanguage ?? null,
    meta: {
      daily_date: dayStart.slice(0, 10)
    }
  });
}

