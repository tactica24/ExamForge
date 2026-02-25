import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { MockRunner } from "@/components/mock/mock-runner";

export default async function MockExamRunPage(props: { params: Promise<{ quizId: string }> }) {
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
  if (!quiz) redirect("/mock-exam");

  const durationSec = Number((quiz.meta as any)?.duration_sec ?? 3600);

  const { data: questions } = await firebase
    .from("quiz_questions")
    .select("id,question,options")
    .eq("quiz_id", quizId)
    .order("id", { ascending: true });

  const safeQuestions =
    questions?.map((q) => ({
      id: q.id,
      question: q.question,
      options: Array.isArray(q.options) ? (q.options as any[]).map(String) : []
    })) ?? [];

  return (
    <MockRunner
      quizId={quizId}
      title={`${quiz.subject} | Mock exam`}
      durationSec={durationSec}
      questions={safeQuestions}
    />
  );
}
