import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MockRunner } from "@/components/mock/mock-runner";

export default async function MockExamRunPage(props: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await props.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
  if (!quiz) redirect("/mock-exam");

  const durationSec = Number((quiz.meta as any)?.duration_sec ?? 3600);

  const { data: questions } = await supabase
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
      title={`${quiz.subject} · Mock exam`}
      durationSec={durationSec}
      questions={safeQuestions}
    />
  );
}
