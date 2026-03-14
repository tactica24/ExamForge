import { redirect } from "next/navigation";
import { createBackendServerClient } from "@/lib/backend/server";
import { MockRunner } from "@/components/mock/mock-runner";

export default async function MockExamRunPage(props: { params: Promise<{ quizId: string }> }) {
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
  if (!quiz) redirect("/mock-exam");

  const durationSec = Number((quiz.meta as any)?.duration_sec ?? 3600);

  const { data: questions } = await backend
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

