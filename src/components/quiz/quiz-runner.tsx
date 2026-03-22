"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { enqueueQuizSubmission } from "@/lib/offline/quiz-queue";

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  explanation: string;
};

export function QuizRunner(props: { quizId: string; title: string; questions: QuizQuestion[] }) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<number[]>(() => props.questions.map(() => -1));
  const [current, setCurrent] = React.useState(0);
  const [showExplanation, setShowExplanation] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const q = props.questions[current] ?? null;
  const answeredAll = answers.every((a) => a >= 0);
  const selected = current >= 0 && current < answers.length ? answers[current] >= 0 : false;

  React.useEffect(() => {
    setShowExplanation(false);
  }, [current]);

  async function finish() {
    if (!answeredAll || submitting) return;

    if (!navigator.onLine) {
      enqueueQuizSubmission({ quizId: props.quizId, answers });
      toast.message("Saved offline. We will sync when you are back online.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/quizzes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: props.quizId, answers })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message ?? "Could not save result.");
      toast.success(`Score: ${json.score}/${json.total}`);
      const unlocked = json?.gamification?.unlockedBadges;
      if (Array.isArray(unlocked) && unlocked.length) {
        toast.success(`Unlocked badge${unlocked.length === 1 ? "" : "s"}: ${unlocked.join(", ")}`);
      }
      router.push(`/quiz/${props.quizId}/review`);
    } catch (e: any) {
      if (!navigator.onLine) {
        enqueueQuizSubmission({ quizId: props.quizId, answers });
        toast.message("Saved offline. We will sync when you are back online.");
        router.push("/dashboard");
        return;
      }
      toast.error(e?.message ?? "Could not save your result. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!q) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{props.title}</CardTitle>
            <CardDescription>This quiz is unavailable right now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The quiz questions could not be loaded. Please return to your study plan and start the quiz again.
            </p>
            <Button type="button" onClick={() => router.push("/plan")}>
              Return to study plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
          <CardDescription>
            Question {current + 1} of {props.questions.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-medium">{q.question}</div>
          <div className="grid gap-2">
            {q.options.map((opt, idx) => {
              const isSelected = answers[current] === idx;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    setShowExplanation(false);
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[current] = idx;
                      return next;
                    });
                  }}
                  className={[
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    isSelected ? "border-primary bg-primary/10" : "hover:bg-accent"
                  ].join(" ")}
                >
                  <div className="font-medium">{String.fromCharCode(65 + idx)}.</div>
                  <div className="text-muted-foreground">{opt}</div>
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">Explanation</div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowExplanation((v) => !v)}>
                  {showExplanation ? "Hide" : "Show"}
                </Button>
              </div>
              {showExplanation ? (
                <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{q.explanation}</div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">Reveal after you commit to an answer.</div>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={current === 0}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={current === props.questions.length - 1}
              onClick={() => setCurrent((c) => Math.min(props.questions.length - 1, c + 1))}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button type="button" className="w-full" onClick={finish} disabled={!answeredAll || submitting}>
        {submitting ? "Saving..." : "Finish objective questions"}
      </Button>
      {!answeredAll ? (
        <p className="text-center text-xs text-muted-foreground">Answer all questions to finish.</p>
      ) : null}
    </div>
  );
}
