"use client";

import * as React from "react";
import { formatISO } from "date-fns";
import type { Database } from "@/lib/firebase/database.types";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completeOnboardingAction } from "@/app/(app)/onboarding/actions";
import { mergeNigerianAndExamSubjects, mergeUniqueSubjects } from "@/data/subjects";

type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

const learningStyles = [
  { value: "visual", label: "Visual (diagrams, charts)" },
  { value: "auditory", label: "Auditory (listen and repeat)" },
  { value: "reading", label: "Reading/Writing (notes, summaries)" },
  { value: "kinesthetic", label: "Kinesthetic (practice + drills)" }
];

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

function getInitialExam(exams: ExamRow[], preferredExamSlugs: string[]): ExamRow | null {
  if (!exams.length) return null;

  for (const slug of preferredExamSlugs) {
    const matched = exams.find((exam) => exam.slug === slug);
    if (matched) return matched;
  }

  return exams[0] ?? null;
}

export function OnboardingWizard(props: {
  exams: ExamRow[];
  preferredExamSlugs?: string[];
  initialName?: string;
  initialLocation?: string;
}) {
  const initialExam = React.useMemo(() => {
    return getInitialExam(props.exams, props.preferredExamSlugs ?? []);
  }, [props.exams, props.preferredExamSlugs]);

  const [examId, setExamId] = React.useState<string>(initialExam?.id ?? "");
  const [examSlug, setExamSlug] = React.useState<string>(initialExam?.slug ?? "");
  const [subject, setSubject] = React.useState<string>(() => {
    const subjects = subjectsForExam(initialExam);
    return subjects[0] ?? "";
  });
  const [learningStyle, setLearningStyle] = React.useState<string>("visual");
  const [level, setLevel] = React.useState<string>("beginner");
  const [mode, setMode] = React.useState<string>("solo");
  const [pace, setPace] = React.useState<string>("steady");

  const subjects = React.useMemo(() => {
    const exam = props.exams.find((item) => item.id === examId);
    return subjectsForExam(exam);
  }, [props.exams, examId]);

  React.useEffect(() => {
    if (!subjects.length) return;
    if (!subjects.includes(subject)) setSubject(subjects[0] ?? "");
  }, [subjects, subject]);

  const defaultStart = formatISO(new Date(), { representation: "date" });

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your first plan. You can add more exams and subjects later in settings.
        </p>
      </div>

      <AuthFormState action={completeOnboardingAction}>
        <Card className="space-y-4 p-5 sm:p-6">
          <div className="text-sm font-medium">1) Profile</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Your name" defaultValue={props.initialName ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="City, Country" defaultValue={props.initialLocation ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" name="timezone" defaultValue="Africa/Lagos" />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <div className="text-sm font-medium">2) How you learn</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Learning style</Label>
              <Select value={learningStyle} onValueChange={(value) => setLearningStyle(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                <SelectContent>
                  {learningStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="learning_style" value={learningStyle} />
            </div>
            <div className="space-y-2">
              <Label>Current level</Label>
              <Select value={level} onValueChange={(value) => setLevel(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="level" value={level} />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <div className="text-sm font-medium">3) Your first plan</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Exam</Label>
              <Select
                value={examId}
                onValueChange={(id) => {
                  setExamId(id);
                  const exam = props.exams.find((item) => item.id === id);
                  setExamSlug(exam?.slug ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {props.exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} - {exam.country_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="exam_id" value={examId} />
              <input type="hidden" name="exam_slug" value={examSlug} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={(value) => setSubject(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="subject" value={subject} />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(value) => setMode(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Solo or group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solo">Solo</SelectItem>
                  <SelectItem value="group">Group (matched)</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="mode" value={mode} />
            </div>
            <div className="space-y-2">
              <Label>Pace</Label>
              <Select value={pace} onValueChange={(value) => setPace(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="steady">Steady (1 topic/day)</SelectItem>
                  <SelectItem value="intensive">Intensive (2 topics/day)</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="pace" value={pace} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={defaultStart} required />
            </div>
          </div>
        </Card>

        <SubmitButton type="submit" className="w-full" pendingText="Building your plan...">
          Finish and go to dashboard
        </SubmitButton>
      </AuthFormState>
    </div>
  );
}

