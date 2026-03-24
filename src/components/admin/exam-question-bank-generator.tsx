"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SubjectState = {
  status: "idle" | "running" | "completed" | "failed";
  progressPercent: number;
  currentSubjectCount: number;
  targetQuestionCount: number;
  totalStored: number;
  totalApproved: number;
  totalGenerated: number;
  error?: string;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ExamQuestionBankGenerator(props: {
  examId: string;
  examName: string;
  subjects: string[];
}) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<string>("Ready to generate 200 questions per subject.");
  const [subjectStates, setSubjectStates] = React.useState<Record<string, SubjectState>>(() =>
    Object.fromEntries(
      props.subjects.map((subject) => [
        subject,
        {
          status: "idle",
          progressPercent: 0,
          currentSubjectCount: 0,
          targetQuestionCount: 200,
          totalStored: 0,
          totalApproved: 0,
          totalGenerated: 0
        } satisfies SubjectState
      ])
    )
  );

  const orderedStates = props.subjects.map((subject) => ({
    subject,
    state: subjectStates[subject] ?? {
      status: "idle",
      progressPercent: 0,
      currentSubjectCount: 0,
      targetQuestionCount: 200,
      totalStored: 0,
      totalApproved: 0,
      totalGenerated: 0
    }
  }));

  const overallPercent = clampPercent(
    props.subjects.length
      ? orderedStates.reduce((sum, entry) => sum + entry.state.progressPercent, 0) / props.subjects.length
      : 0
  );

  async function startGeneration() {
    if (running) return;
    setRunning(true);
    setError(null);
    setSummary(`Generating question banks for ${props.examName}...`);
    setSubjectStates(
      Object.fromEntries(
        props.subjects.map((subject) => [
          subject,
          {
            status: "idle",
            progressPercent: 0,
            currentSubjectCount: 0,
            targetQuestionCount: 200,
            totalStored: 0,
            totalApproved: 0,
            totalGenerated: 0
          } satisfies SubjectState
        ])
      )
    );

    try {
      const response = await fetch(`/api/admin/exams/${props.examId}/question-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok || !response.body) {
        throw new Error("Could not start question-bank generation.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";

        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const event = JSON.parse(trimmed) as Record<string, any>;
          const subject = String(event.subject ?? "");

          if (event.type === "start") {
            setSummary(`Generating 200 questions per subject for ${String(event.examName ?? props.examName)}.`);
            continue;
          }

          if (event.type === "subject_start" && subject) {
            setSummary(`Generating ${subject}...`);
            setSubjectStates((prev) => ({
              ...prev,
              [subject]: {
                ...(prev[subject] ?? {
                  status: "idle",
                  progressPercent: 0,
                  currentSubjectCount: 0,
                  targetQuestionCount: 200,
                  totalStored: 0,
                  totalApproved: 0,
                  totalGenerated: 0
                }),
                status: "running"
              }
            }));
            continue;
          }

          if (event.type === "subject_progress" && subject) {
            setSubjectStates((prev) => ({
              ...prev,
              [subject]: {
                status: String(event.status ?? "running") === "completed" ? "completed" : "running",
                progressPercent: clampPercent(Number(event.progressPercent ?? 0)),
                currentSubjectCount: Number(event.currentSubjectCount ?? 0),
                targetQuestionCount: Number(event.targetQuestionCount ?? 200) || 200,
                totalStored: Number(event.totalStored ?? 0),
                totalApproved: Number(event.totalApproved ?? 0),
                totalGenerated: Number(event.totalGenerated ?? 0),
                error: event.error ? String(event.error) : undefined
              }
            }));
            continue;
          }

          if (event.type === "subject_complete" && subject) {
            setSummary(`${subject} completed.`);
            setSubjectStates((prev) => ({
              ...prev,
              [subject]: {
                status: "completed",
                progressPercent: 100,
                currentSubjectCount: Number(event.currentSubjectCount ?? prev[subject]?.currentSubjectCount ?? 0),
                targetQuestionCount: Number(event.targetQuestionCount ?? prev[subject]?.targetQuestionCount ?? 200) || 200,
                totalStored: Number(event.totalStored ?? prev[subject]?.totalStored ?? 0),
                totalApproved: Number(event.totalApproved ?? prev[subject]?.totalApproved ?? 0),
                totalGenerated: Number(event.totalGenerated ?? prev[subject]?.totalGenerated ?? 0)
              }
            }));
            continue;
          }

          if (event.type === "error") {
            const message = String(event.message ?? "Question-bank generation failed.");
            setError(message);
            if (subject) {
              setSubjectStates((prev) => ({
                ...prev,
                [subject]: {
                  ...(prev[subject] ?? {
                    status: "idle",
                    progressPercent: 0,
                    currentSubjectCount: 0,
                    targetQuestionCount: 200,
                    totalStored: 0,
                    totalApproved: 0,
                    totalGenerated: 0
                  }),
                  status: "failed",
                  error: message
                }
              }));
            }
            continue;
          }

          if (event.type === "complete") {
            setSummary("Question bank generation completed.");
            React.startTransition(() => {
              router.refresh();
            });
          }
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Question-bank generation failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Generate full exam bank</div>
          <div className="text-xs text-muted-foreground">{summary}</div>
        </div>
        <Button onClick={startGeneration} disabled={running || !props.subjects.length}>
          {running ? "Generating..." : "Generate exam bank"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Overall progress</span>
          <span>{overallPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overallPercent}%` }} />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        {orderedStates.map(({ subject, state }) => (
          <div key={subject} className="rounded-lg border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{subject}</div>
                <div className="text-xs text-muted-foreground">
                  {state.currentSubjectCount}/{state.targetQuestionCount} stored
                  {state.totalApproved ? ` | ${state.totalApproved} auto-approved this run` : ""}
                </div>
              </div>
              <div className="text-xs capitalize text-muted-foreground">{state.status}</div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${state.progressPercent}%` }} />
            </div>
            {state.error ? <div className="mt-2 text-xs text-destructive">{state.error}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
