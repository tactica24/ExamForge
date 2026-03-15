"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ReviewQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  user_index: number;
};

export function QuizReview(props: {
  quizId?: string;
  examId?: string;
  examName: string;
  subject: string;
  questions: ReviewQuestion[];
  initialFeedback?: Record<string, string>;
}) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = React.useState(false);
  const [ai, setAi] = React.useState<Record<string, string>>(props.initialFeedback ?? {});

  const wrongQuestions = React.useMemo(
    () => props.questions.filter((q) => q.correct_index !== q.user_index),
    [props.questions]
  );
  const correctCount = props.questions.length - wrongQuestions.length;

  async function explain(q: ReviewQuestion) {
    try {
      setLoadingId(q.id);
      const res = await fetch("/api/ai/explain-wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: props.quizId,
          question_id: q.id,
          refresh: Boolean(ai[q.id]),
          exam_id: props.examId,
          exam: props.examName,
          subject: props.subject,
          question: q.question,
          options: q.options,
          correct_index: q.correct_index,
          user_index: q.user_index
        })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message ?? "Explain failed.");
      setAi((prev) => ({ ...prev, [q.id]: String(json.answer ?? "") }));
    } catch (e: any) {
      toast.error(e?.message ?? "Explain error.");
    } finally {
      setLoadingId(null);
    }
  }

  React.useEffect(() => {
    const missingQuestions = wrongQuestions.filter((q) => !ai[q.id]);
    if (!missingQuestions.length) return;

    let active = true;

    async function autoExplainWrong() {
      try {
        setBulkLoading(true);
        const res = await fetch("/api/ai/explain-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quiz_id: props.quizId,
            exam_id: props.examId,
            exam: props.examName,
            subject: props.subject,
            questions: missingQuestions.map((q) => ({
              id: q.id,
              question: q.question,
              options: q.options,
              correct_index: q.correct_index,
              user_index: q.user_index
            }))
          })
        });
        const json = await res.json();
        if (!active || !json?.ok || typeof json?.answers !== "object") return;
        const next = Object.fromEntries(
          Object.entries(json.answers as Record<string, unknown>)
            .filter(([key, value]) => key && typeof value === "string" && value.length)
            .map(([key, value]) => [key, String(value)])
        );
        if (Object.keys(next).length) {
          setAi((prev) => ({ ...prev, ...next }));
        }
      } catch {
        // Keep default explanations visible if AI auto-explain fails.
      } finally {
        if (active) setBulkLoading(false);
      }
    }

    autoExplainWrong();
    return () => {
      active = false;
    };
  }, [wrongQuestions, ai, props.quizId, props.examId, props.examName, props.subject]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <div className="rounded-full border bg-muted/40 px-3 py-1">
            Correct: <span className="font-semibold">{correctCount}</span>
          </div>
          <div className="rounded-full border bg-muted/40 px-3 py-1">
            Incorrect: <span className="font-semibold">{wrongQuestions.length}</span>
          </div>
          {bulkLoading ? (
            <div className="text-muted-foreground">Preparing detailed feedback for missed questions...</div>
          ) : null}
        </CardContent>
      </Card>

      {props.questions.map((q, idx) => {
        const correct = q.correct_index === q.user_index;
        const aiText = ai[q.id];
        return (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">
                Q{idx + 1}: {correct ? "Correct" : "Incorrect"}
              </CardTitle>
              <CardDescription>{q.question}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                {q.options.map((o, i) => {
                  const isUser = i === q.user_index;
                  const isCorrect = i === q.correct_index;
                  return (
                    <div
                      key={i}
                      className={[
                        "rounded-lg border px-3 py-2 text-sm",
                        isCorrect ? "border-green-500/40 bg-green-500/10" : "",
                        !isCorrect && isUser ? "border-destructive/40 bg-destructive/10" : ""
                      ].join(" ")}
                    >
                      <div className="font-medium">
                        {String.fromCharCode(65 + i)}.{" "}
                        {isCorrect ? <span className="text-green-700">Correct answer</span> : null}
                        {!isCorrect && isUser ? <span className="text-destructive">Your choice</span> : null}
                      </div>
                      <div className="text-muted-foreground">{o}</div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                <div className="text-xs font-medium text-muted-foreground">Explanation</div>
                <div className="mt-2 whitespace-pre-wrap">{q.explanation}</div>
              </div>

              {!correct ? (
                <>
                  {aiText ? (
                    <div className="rounded-xl border bg-card p-3 text-sm">
                      <div className="text-xs font-medium text-muted-foreground">Detailed feedback</div>
                      <div className="mt-2 whitespace-pre-wrap">{aiText}</div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-card p-3 text-sm text-muted-foreground">
                      {bulkLoading ? "Preparing detailed feedback..." : "Detailed feedback not ready yet."}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => explain(q)} disabled={loadingId === q.id}>
                      {loadingId === q.id ? "Thinking..." : aiText ? "Refresh explanation" : "Generate explanation"}
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
