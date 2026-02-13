import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QuizRunner } from "@/components/quiz/quiz-runner";

export default async function QuizPage(props: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await props.params;
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
  if (!quiz) redirect("/dashboard");

  const { data: questions } = await supabase
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

  return (
    <QuizRunner
      quizId={quizId}
      title={`${quiz.subject} · ${quiz.topic_path}`}
      questions={safeQuestions}
    />
  );
}

