"use client";

import * as React from "react";
import type { Database } from "@/lib/firebase/database.types";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { completeOnboardingAction } from "@/app/(app)/onboarding/actions";
import { mergeNigerianAndExamSubjects, mergeUniqueSubjects } from "@/data/subjects";

type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

const MAX_SUBJECTS = 7;

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

function getInitialExamId(exams: ExamRow[], preferredExamSlugs: string[]) {
  const preferred = exams.find((exam) => preferredExamSlugs.includes(exam.slug));
  return preferred?.id ?? exams[0]?.id ?? "";
}

export function OnboardingWizard(props: {
  exams: ExamRow[];
  preferredExamSlugs?: string[];
}) {
  const [examId, setExamId] = React.useState(() =>
    getInitialExamId(props.exams, props.preferredExamSlugs ?? [])
  );
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]);

  const selectedExam = React.useMemo(
    () => props.exams.find((exam) => exam.id === examId) ?? null,
    [props.exams, examId]
  );
  const availableSubjects = React.useMemo(() => subjectsForExam(selectedExam), [selectedExam]);

  React.useEffect(() => {
    setSelectedSubjects((current) => current.filter((subject) => availableSubjects.includes(subject)));
  }, [availableSubjects]);

  function toggleSubject(subject: string) {
    setSelectedSubjects((current) => {
      if (current.includes(subject)) {
        return current.filter((item) => item !== subject);
      }
      if (current.length >= MAX_SUBJECTS) return current;
      return [...current, subject];
    });
  }

  const canSubmit = Boolean(selectedExam?.id) && selectedSubjects.length > 0 && selectedSubjects.length <= MAX_SUBJECTS;

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Choose your first exam</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick one exam and the subjects you want to start with. You can add more exams later from Settings.
        </p>
      </div>

      <AuthFormState action={completeOnboardingAction}>
        <Card className="space-y-4 p-5 sm:p-6">
          <div className="text-sm font-medium">1) Select an exam</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {props.exams.map((exam) => {
              const checked = exam.id === examId;

              return (
                <label
                  key={exam.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border/70 bg-card"
                  } cursor-pointer`}
                >
                  <input
                    type="radio"
                    name="exam_id"
                    className="mt-1 h-4 w-4 accent-black"
                    checked={checked}
                    onChange={() => setExamId(exam.id)}
                    value={exam.id}
                  />
                  <div>
                    <div className="text-sm font-semibold">{exam.name}</div>
                    <div className="text-xs text-muted-foreground">{exam.country_code}</div>
                  </div>
                </label>
              );
            })}
          </div>

          <input type="hidden" name="exam_slug" value={selectedExam?.slug ?? ""} />
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <div className="text-sm font-medium">2) Choose up to 7 subjects</div>
          {selectedExam ? (
            <>
              <div className="space-y-2">
                <Label>{selectedExam.name} subjects</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {availableSubjects.map((subject) => {
                    const checked = selectedSubjects.includes(subject);
                    const disabled = !checked && selectedSubjects.length >= MAX_SUBJECTS;

                    return (
                      <label
                        key={subject}
                        className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                          checked ? "border-primary bg-primary/5" : "border-border/70 bg-card"
                        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          name="subjects"
                          className="mt-1 h-4 w-4 accent-black"
                          value={subject}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleSubject(subject)}
                        />
                        <div className="text-sm font-medium">{subject}</div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedSubjects.length}/{MAX_SUBJECTS}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select an exam first.</p>
          )}
        </Card>

        <SubmitButton type="submit" className="w-full" pendingText="Creating your study plan..." disabled={!canSubmit}>
          Continue to dashboard
        </SubmitButton>
      </AuthFormState>
    </div>
  );
}
