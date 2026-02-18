"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type ExamOption = {
  id: string;
  slug: string;
  name: string;
  subjects: string[];
};

export function MockExamConfig(props: { exams: ExamOption[]; defaultExamId?: string; defaultSubject?: string }) {
  const initialExam =
    props.exams.find((item) => item.id === props.defaultExamId) ?? props.exams[0];
  const [examId, setExamId] = React.useState(initialExam?.id ?? "");
  const [subject, setSubject] = React.useState(props.defaultSubject ?? initialExam?.subjects?.[0] ?? "");

  const exam = React.useMemo(() => props.exams.find((item) => item.id === examId), [props.exams, examId]);
  const subjects = exam?.subjects ?? [];

  React.useEffect(() => {
    if (!subjects.length) return;
    if (!subjects.includes(subject)) setSubject(subjects[0] ?? "");
  }, [subjects, subject]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Exam</Label>
        <NativeSelect name="exam_id" value={examId} onChange={(e) => setExamId(e.target.value)} required>
          {props.exams.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
        <input type="hidden" name="exam_slug" value={exam?.slug ?? ""} />
      </div>
      <div className="space-y-2">
        <Label>Subject</Label>
        <NativeSelect name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required>
          {subjects.length ? null : <option value="">Select exam first</option>}
          {subjects.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="question_count">Questions</Label>
        <Input id="question_count" name="question_count" type="number" min={10} max={100} defaultValue={40} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="duration_min">Duration (minutes)</Label>
        <Input id="duration_min" name="duration_min" type="number" min={5} max={180} defaultValue={60} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Difficulty</Label>
        <NativeSelect name="difficulty" defaultValue="medium">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </NativeSelect>
      </div>
    </div>
  );
}
