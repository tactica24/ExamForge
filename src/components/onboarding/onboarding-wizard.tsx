"use client";

import * as React from "react";
import { addDays, formatISO } from "date-fns";
import type { Database } from "@/lib/firebase/database.types";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completeOnboardingAction } from "@/app/(app)/onboarding/actions";
import { nigeriaStateOptions } from "@/data/location-options";
import { mergeNigerianAndExamSubjects, mergeUniqueSubjects } from "@/data/subjects";

type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

const learningStyles = [
  { value: "visual", label: "Visual (diagrams, charts)" },
  { value: "auditory", label: "Auditory (listen and repeat)" },
  { value: "reading", label: "Reading/Writing (notes, summaries)" }
];

const onboardingCountryOptions = [
  "Nigeria",
  "Ghana",
  "Benin",
  "Togo",
  "Cote d'Ivoire",
  "Liberia",
  "Sierra Leone",
  "Senegal"
] as const;

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
  initialPhone?: string;
  initialCountry?: string;
  initialState?: string;
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
  const [country, setCountry] = React.useState<string>(
    onboardingCountryOptions.includes((props.initialCountry as (typeof onboardingCountryOptions)[number]) ?? "Nigeria")
      ? (props.initialCountry as string)
      : "Nigeria"
  );
  const [state, setState] = React.useState<string>(props.initialState ?? "");

  const subjects = React.useMemo(() => {
    const exam = props.exams.find((item) => item.id === examId);
    return subjectsForExam(exam);
  }, [props.exams, examId]);

  React.useEffect(() => {
    if (!subjects.length) return;
    if (!subjects.includes(subject)) setSubject(subjects[0] ?? "");
  }, [subjects, subject]);

  React.useEffect(() => {
    if (country !== "Nigeria" && state) {
      setState("");
    }
  }, [country, state]);

  const defaultStart = formatISO(new Date(), { representation: "date" });
  const defaultTarget = formatISO(addDays(new Date(), 90), { representation: "date" });

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
              <Label htmlFor="phone">Phone (for reminders/WhatsApp)</Label>
              <Input id="phone" name="phone" type="tel" placeholder="+234 801 234 5678" defaultValue={props.initialPhone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <NativeSelect id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} required>
                {onboardingCountryOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {country === "Nigeria" ? (
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <NativeSelect id="state" name="state" value={state} onChange={(e) => setState(e.target.value)} required>
                  <option value="">Select state</option>
                  {nigeriaStateOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
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
              <Label>Topics per day</Label>
              <Select value={pace} onValueChange={(value) => setPace(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select daily load" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="steady">1 topic/day</SelectItem>
                  <SelectItem value="intensive">2 topics/day</SelectItem>
                  <SelectItem value="topics_3">3 topics/day</SelectItem>
                  <SelectItem value="topics_4">4 topics/day</SelectItem>
                  <SelectItem value="topics_5">5 topics/day</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="pace" value={pace} />
              <p className="text-xs text-muted-foreground">
                Increase daily load if you want faster syllabus coverage.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={defaultStart} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="target_date">Exam date (target)</Label>
              <Input id="target_date" name="target_date" type="date" defaultValue={defaultTarget} />
              <p className="text-xs text-muted-foreground">
                Optional but recommended. Your plan auto-adjusts so topics are completed before this date.
              </p>
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
