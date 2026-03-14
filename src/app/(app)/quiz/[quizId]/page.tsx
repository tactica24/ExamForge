import { redirect } from "next/navigation";
import { createBackendServerClient } from "@/lib/backend/server";
import { QuizRunner } from "@/components/quiz/quiz-runner";

export default async function QuizPage(props: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await props.params;
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) redirect("/login");

  const { data: quiz } = await backend
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .eq("created_by", user.id)
    .maybeSingle();
  if (!quiz) redirect("/dashboard");

  const { data: questions } = await backend
    .from("quiz_questions")
    .select("id,question,options,explanation")
    .eq("quiz_id", quizId)
    .order("id", { ascending: true });

  const safeQuestions =
    questions?.map((q) => ({
      id: q.id,
      question: q.question,
      options: Array.isArray(q.options) ? (q.options as any[]).map(String) : [],
      explanation: q.explanation
    })) ?? [];

  return <QuizRunner quizId={quizId} title={`${quiz.subject} | ${quiz.topic_path}`} questions={safeQuestions} />;
}

