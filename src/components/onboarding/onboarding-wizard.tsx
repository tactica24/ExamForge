"use client";

import * as React from "react";
import type { Database } from "@/lib/firebase/database.types";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { completeOnboardingAction } from "@/app/(app)/onboarding/actions";
import { mergeNigerianAndExamSubjects, mergeUniqueSubjects } from "@/data/subjects";

type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

type ExamSelection = {
  exam_id: string;
  exam_slug: string;
  subjects: string[];
};

const MAX_EXAMS = 3;
const MAX_SUBJECTS_PER_EXAM = 7;

function toSubjectList(value: ExamRow["subjects"]): string[] {
  return Array.isArray(value) ? (value as unknown as string[]) : [];
}

function subjectsForExam(exam: ExamRow | null | undefined) {
  if (!exam) return [];
  const base = toSubjectList(exam.subjects);
  if (exam.slug === "waec" || exam.slug === "neco" || exam.slug === "jamb") {
    return mergeNigerianAndExamSubjects(base);
  }
  return mergeUniqueSubjects(base);
}

function buildInitialSelections(exams: ExamRow[], preferredExamSlugs: string[]) {
  const preferred = exams.filter((exam) => preferredExamSlugs.includes(exam.slug)).slice(0, MAX_EXAMS);
  return preferred.map((exam) => ({
    exam_id: exam.id,
    exam_slug: exam.slug,
    subjects: []
  }));
}

export function OnboardingWizard(props: {
  exams: ExamRow[];
  preferredExamSlugs?: string[];
}) {
  const [selections, setSelections] = React.useState<ExamSelection[]>(() =>
    buildInitialSelections(props.exams, props.preferredExamSlugs ?? [])
  );

  const examById = React.useMemo(
    () => new Map(props.exams.map((exam) => [exam.id, exam])),
    [props.exams]
  );

  const selectedExamIds = React.useMemo(
    () => new Set(selections.map((selection) => selection.exam_id)),
    [selections]
  );

  function toggleExam(exam: ExamRow) {
    setSelections((current) => {
      const exists = current.some((item) => item.exam_id === exam.id);
      if (exists) {
        return current.filter((item) => item.exam_id !== exam.id);
      }
      if (current.length >= MAX_EXAMS) return current;
      return [
        ...current,
        {
          exam_id: exam.id,
          exam_slug: exam.slug,
          subjects: []
        }
      ];
    });
  }

  function updateSubjects(examId: string, values: string[]) {
    setSelections((current) =>
      current.map((item) =>
        item.exam_id === examId
          ? {
              ...item,
              subjects: values.slice(0, MAX_SUBJECTS_PER_EXAM)
            }
          : item
      )
    );
  }

  const canSubmit =
    selections.length > 0 &&
    selections.every((selection) => selection.subjects.length >= 1 && selection.subjects.length <= MAX_SUBJECTS_PER_EXAM);

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Choose your exams and subjects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select up to 3 exams, then choose up to 7 subjects for each one. We will build your study plans from that.
        </p>
      </div>

      <AuthFormState action={completeOnboardingAction}>
        <input type="hidden" name="exam_subjects" value={JSON.stringify(selections)} />

        <Card className="space-y-4 p-5 sm:p-6">
          <div className="text-sm font-medium">1) Select exams</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {props.exams.map((exam) => {
              const checked = selectedExamIds.has(exam.id);
              const disabled = !checked && selections.length >= MAX_EXAMS;

              return (
                <label
                  key={exam.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border/70 bg-card"
                  } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-black"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleExam(exam)}
                  />
                  <div>
                    <div className="text-sm font-semibold">{exam.name}</div>
                    <div className="text-xs text-muted-foreground">{exam.country_code}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Selected: {selections.length}/{MAX_EXAMS}
          </p>
        </Card>

        {selections.map((selection, index) => {
          const exam = examById.get(selection.exam_id);
          const subjects = subjectsForExam(exam);

          return (
            <Card key={selection.exam_id} className="space-y-4 p-5 sm:p-6">
              <div className="text-sm font-medium">
                {index + 2}) {exam?.name ?? "Exam"} subjects
              </div>
              <div className="space-y-2">
                <Label htmlFor={`subjects-${selection.exam_id}`}>Select up to 7 subjects</Label>
                <NativeSelect
                  id={`subjects-${selection.exam_id}`}
                  multiple
                  value={selection.subjects}
                  onChange={(event) => {
                    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                    updateSubjects(selection.exam_id, values);
                  }}
                  className="h-40"
                >
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  Selected: {selection.subjects.length}/{MAX_SUBJECTS_PER_EXAM}. On desktop, use Ctrl/Cmd to select multiple.
                </p>
              </div>
            </Card>
          );
        })}

        <SubmitButton type="submit" className="w-full" pendingText="Creating your study plans..." disabled={!canSubmit}>
          Continue to dashboard
        </SubmitButton>
      </AuthFormState>
    </div>
  );
}
