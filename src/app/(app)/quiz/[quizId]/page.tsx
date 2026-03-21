import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { QuizRunner } from "@/components/quiz/quiz-runner";

export default async function QuizPage(props: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await props.params;
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quiz } = await firebase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .eq("created_by", user.id)
    .maybeSingle();
  if (!quiz) redirect("/dashboard");

  const { data: questions } = await firebase
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

  if (!safeQuestions.length) {
    redirect("/dashboard");
  }

  return <QuizRunner quizId={quizId} title={`${quiz.subject} | ${quiz.topic_path}`} questions={safeQuestions} />;
}
