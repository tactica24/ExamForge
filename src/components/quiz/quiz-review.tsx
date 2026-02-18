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

export function QuizReview(props: { examId?: string; examName: string; subject: string; questions: ReviewQuestion[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [ai, setAi] = React.useState<Record<string, string>>({});

  async function explain(q: ReviewQuestion) {
    try {
      setLoading(true);
      const res = await fetch("/api/ai/explain-wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      setOpen(q.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Explain error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
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
                        {isCorrect ? <span className="text-green-700">Correct</span> : null}
                        {!isCorrect && isUser ? <span className="text-destructive">Your choice</span> : null}
                      </div>
                      <div className="text-muted-foreground">{o}</div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                <div className="text-xs font-medium text-muted-foreground">Default explanation</div>
                <div className="mt-2 whitespace-pre-wrap">{q.explanation}</div>
              </div>

              {!correct ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => explain(q)} disabled={loading}>
                    {loading ? "Thinking..." : "Explain why I'm wrong"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setOpen((v) => (v === q.id ? null : q.id))}
                    disabled={!aiText}
                  >
                    {open === q.id ? "Hide AI" : "Show AI"}
                  </Button>
                </div>
              ) : null}

              {aiText && open === q.id ? (
                <div className="rounded-xl border bg-card p-3 text-sm">
                  <div className="text-xs font-medium text-muted-foreground">AI coach</div>
                  <div className="mt-2 whitespace-pre-wrap">{aiText}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

