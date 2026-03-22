import Link from "next/link";
import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadQuizQuestionsWithRetry(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  quizId: string;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: questions } = await args.firebase
      .from("quiz_questions")
      .select("id,question,options,explanation")
      .eq("quiz_id", args.quizId);

    const safeQuestions =
      (questions ?? [])
        .map((q) => ({
          id: q.id,
          question: q.question,
          options: Array.isArray(q.options) ? (q.options as any[]).map(String) : [],
          explanation: q.explanation
        }))
        .sort((left, right) => String(left.id).localeCompare(String(right.id)));

    if (safeQuestions.length) return safeQuestions;
    if (attempt < 2) await wait(300 * (attempt + 1));
  }

  return [];
}

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
  if (!quiz) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiz unavailable</CardTitle>
            <CardDescription>We could not find that quiz for your account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/quiz/extra">Generate another quiz</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/plan">Return to study plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const safeQuestions = await loadQuizQuestionsWithRetry({ firebase, quizId });

  if (!safeQuestions.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiz is still preparing</CardTitle>
            <CardDescription>Your questions are not ready yet. Please reload this page in a moment.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/quiz/${quizId}`}>Reload quiz</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/quiz/extra">Back to extra practice</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <QuizRunner quizId={quizId} title={`${quiz.subject} | ${quiz.topic_path}`} questions={safeQuestions} />;
}
