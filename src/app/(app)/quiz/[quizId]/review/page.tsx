import Link from "next/link";
import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuizReview } from "@/components/quiz/quiz-review";
import { getStoredReviewFeedback } from "@/lib/quizzes/review-feedback";

export default async function QuizReviewPage(props: { params: Promise<{ quizId: string }> }) {
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

  const { data: exam } = await firebase.from("exams").select("name").eq("id", quiz.exam_id).maybeSingle();
  const examName = exam?.name ?? "Exam";

  const { data: result } = await firebase
    .from("user_quiz_results")
    .select("answers,score,total,created_at")
    .eq("user_id", user.id)
    .eq("quiz_id", quizId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!result) redirect(`/quiz/${quizId}`);

  const answers = Array.isArray(result.answers) ? (result.answers as any[]).map((n) => Number(n)) : [];

  const { data: questions } = await firebase
    .from("quiz_questions")
    .select("id,question,options,correct_index,explanation")
    .eq("quiz_id", quizId)
    .order("id", { ascending: true });

  const qs =
    questions?.map((q, idx) => ({
      id: q.id,
      question: q.question,
      options: Array.isArray(q.options) ? (q.options as any[]).map(String) : [],
      correct_index: q.correct_index,
      explanation: q.explanation,
      user_index: Number(answers[idx] ?? -1)
    })) ?? [];
  const initialDetailedFeedback = getStoredReviewFeedback(quiz.meta);

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Objective question review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quiz.subject} | {quiz.topic_path} | {result.score}/{result.total}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild>
            <Link href="/quiz/extra">Practice more</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Questions</CardTitle>
          <CardDescription>Score is ready. Detailed feedback is reused after it has been generated once.</CardDescription>
        </CardHeader>
        <CardContent>
          <QuizReview
            quizId={quizId}
            examId={quiz.exam_id}
            examName={examName}
            subject={quiz.subject}
            questions={qs as any}
            initialDetailedFeedback={initialDetailedFeedback}
          />
        </CardContent>
      </Card>
    </div>
  );
}
