"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { enqueueQuizSubmission } from "@/lib/offline/quiz-queue";

export type MockQuestion = {
  id: string;
  question: string;
  options: string[];
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MockRunner(props: {
  quizId: string;
  title: string;
  durationSec: number;
  questions: MockQuestion[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<number[]>(() => props.questions.map(() => -1));
  const [current, setCurrent] = React.useState(0);
  const [remaining, setRemaining] = React.useState(props.durationSec);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (remaining === 0) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const q = props.questions[current] ?? null;

  async function finish(auto = false) {
    if (submitting) return;
    setSubmitting(true);

    if (!navigator.onLine) {
      enqueueQuizSubmission({ quizId: props.quizId, answers });
      toast.message(auto ? "Time is up. Saved offline and will sync later." : "Saved offline and will sync later.");
      return;
    }

    try {
      const res = await fetch("/api/quizzes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: props.quizId, answers })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message ?? "Submit failed.");
      toast.success(`Score: ${json.score}/${json.total}`);
      router.push(`/quiz/${props.quizId}/review`);
    } catch (e: any) {
      if (!navigator.onLine) {
        enqueueQuizSubmission({ quizId: props.quizId, answers });
        toast.message("Saved offline and will sync later.");
        return;
      }
      toast.error(e?.message ?? "Could not submit the mock exam. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!q) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="p-5">
          <div className="text-lg font-semibold">{props.title}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This mock exam is unavailable right now. Please reload it or create a new one.
          </p>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={() => router.refresh()}>
              Reload
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/mock-exam")}>
              Back to mock exams
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
          <p className="text-sm text-muted-foreground">
            Timer: <span className="font-medium text-foreground">{formatTime(remaining)}</span> | Question{" "}
            {current + 1}/{props.questions.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => finish(false)} disabled={submitting}>
            Submit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="p-5">
          <div className="text-sm font-medium">{q.question}</div>
          <div className="mt-4 grid gap-2">
            {q.options.map((opt, idx) => {
              const selected = answers[current] === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  className={[
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selected ? "border-primary bg-primary/10" : "hover:bg-accent"
                  ].join(" ")}
                  onClick={() =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[current] = idx;
                      return next;
                    })
                  }
                >
                  <div className="font-medium">{String.fromCharCode(65 + idx)}.</div>
                  <div className="text-muted-foreground">{opt}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-between gap-2">
            <Button variant="secondary" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))}>
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={current === props.questions.length - 1}
              onClick={() => setCurrent((c) => Math.min(props.questions.length - 1, c + 1))}
            >
              Next
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Navigation</div>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {props.questions.map((_, idx) => {
              const done = answers[idx] >= 0;
              const active = idx === current;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrent(idx)}
                  className={[
                    "h-9 rounded-md border text-xs font-medium",
                    active ? "border-primary bg-primary/10" : done ? "bg-muted" : "bg-background",
                    "hover:bg-accent"
                  ].join(" ")}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Tip: answer what you know first, then return to difficult questions.
          </p>
        </Card>
      </div>
    </div>
  );
}
