"use client";

import * as React from "react";
import { formatISO } from "date-fns";
import type { Database } from "@/lib/supabase/database.types";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completeOnboardingAction } from "@/app/(app)/onboarding/actions";

type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

const learningStyles = [
  { value: "visual", label: "Visual (diagrams, charts)" },
  { value: "auditory", label: "Auditory (listen and repeat)" },
  { value: "reading", label: "Reading/Writing (notes, summaries)" },
  { value: "kinesthetic", label: "Kinesthetic (practice + drills)" }
];

export function OnboardingWizard({ exams }: { exams: ExamRow[] }) {
  const [examId, setExamId] = React.useState<string>(exams[0]?.id ?? "");
  const [examSlug, setExamSlug] = React.useState<string>(exams[0]?.slug ?? "");
  const [subject, setSubject] = React.useState<string>(() => {
    const s = exams[0]?.subjects;
    return Array.isArray(s) ? (s[0] as string) : "";
  });
  const [learningStyle, setLearningStyle] = React.useState<string>("visual");
  const [level, setLevel] = React.useState<string>("beginner");
  const [mode, setMode] = React.useState<string>("solo");
  const [pace, setPace] = React.useState<string>("steady");

  const subjects = React.useMemo(() => {
    const e = exams.find((x) => x.id === examId);
    const s = e?.subjects;
    return Array.isArray(s) ? (s as unknown as string[]) : [];
  }, [exams, examId]);

  React.useEffect(() => {
    if (!subjects.length) return;
    if (!subjects.includes(subject)) setSubject(subjects[0]!);
  }, [subjects, subject]);

  const defaultStart = formatISO(new Date(), { representation: "date" });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your first plan. You can add more exams and subjects later.
        </p>
      </div>

      <AuthFormState action={completeOnboardingAction}>
        <Card className="space-y-4 p-6">
          <div className="text-sm font-medium">1) Profile</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Your name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="Abuja, NG" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" name="timezone" defaultValue="Africa/Lagos" />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="text-sm font-medium">2) How you learn</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Learning style</Label>
              <Select value={learningStyle} onValueChange={(v) => setLearningStyle(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                <SelectContent>
                  {learningStyles.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="learning_style" value={learningStyle} />
            </div>
            <div className="space-y-2">
              <Label>Current level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v)}>
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

        <Card className="space-y-4 p-6">
          <div className="text-sm font-medium">3) Your first plan</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Exam</Label>
              <Select
                value={examId}
                onValueChange={(id) => {
                  setExamId(id);
                  const e = exams.find((x) => x.id === id);
                  setExamSlug(e?.slug ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.country_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="exam_id" value={examId} />
              <input type="hidden" name="exam_slug" value={examSlug} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={(v) => setSubject(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="subject" value={subject} />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v)}>
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
              <Select value={pace} onValueChange={(v) => setPace(v)}>
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

        <SubmitButton type="submit" className="w-full" pendingText="Building your plan…">
          Finish and go to dashboard
        </SubmitButton>
      </AuthFormState>
    </div>
  );
}

