"use client";

import * as React from "react";
import { mergeNigerianAndExamSubjects, mergeUniqueSubjects } from "@/data/subjects";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ExamOption = {
  id: string;
  slug: string;
  name: string;
  subjects: string[];
};

type ExistingSelection = {
  examId: string;
  subject: string;
};

function isNigerianCoreExam(slug: string) {
  return slug === "waec" || slug === "neco" || slug === "jamb";
}

function buildExamSubjects(exam: ExamOption) {
  if (isNigerianCoreExam(exam.slug.toLowerCase())) {
    return mergeNigerianAndExamSubjects(exam.subjects);
  }
  return mergeUniqueSubjects(exam.subjects);
}

export function AddExamSubjectFields(props: { exams: ExamOption[]; existingSelections: ExistingSelection[] }) {
  const selectedSet = React.useMemo(
    () => new Set(props.existingSelections.map((item) => `${item.examId}::${item.subject}`)),
    [props.existingSelections]
  );

  const subjectsByExamId = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const exam of props.exams) map.set(exam.id, buildExamSubjects(exam));
    return map;
  }, [props.exams]);

  const selectableExams = React.useMemo(
    () =>
      props.exams.filter((exam) =>
        (subjectsByExamId.get(exam.id) ?? []).some((subject) => !selectedSet.has(`${exam.id}::${subject}`))
      ),
    [props.exams, selectedSet, subjectsByExamId]
  );

  const [examId, setExamId] = React.useState(selectableExams[0]?.id ?? "");

  const availableSubjects = React.useMemo(() => {
    if (!examId) return [];
    return (subjectsByExamId.get(examId) ?? []).filter((subject) => !selectedSet.has(`${examId}::${subject}`));
  }, [examId, selectedSet, subjectsByExamId]);

  const [subject, setSubject] = React.useState(availableSubjects[0] ?? "");

  React.useEffect(() => {
    if (!selectableExams.length) {
      if (examId) setExamId("");
      return;
    }
    if (!selectableExams.some((exam) => exam.id === examId)) {
      setExamId(selectableExams[0]?.id ?? "");
    }
  }, [selectableExams, examId]);

  React.useEffect(() => {
    if (!availableSubjects.length) {
      if (subject) setSubject("");
      return;
    }
    if (!availableSubjects.includes(subject)) {
      setSubject(availableSubjects[0] ?? "");
    }
  }, [availableSubjects, subject]);

  const selectedExam = selectableExams.find((exam) => exam.id === examId);
  const disabled = !selectableExams.length || !availableSubjects.length;

  if (!selectableExams.length) {
    return (
      <div className="space-y-2 sm:col-span-2">
        <input type="hidden" name="exam_id" value="" />
        <input type="hidden" name="exam_slug" value="" />
        <input type="hidden" name="subject" value="" />
        <input type="hidden" name="selection_ready" value="" />
        <p className="text-sm text-muted-foreground">
          You have already added all available exam-subject combinations.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="settings_exam_id">Exam</Label>
        <Select value={examId} onValueChange={setExamId} disabled={!selectableExams.length}>
          <SelectTrigger id="settings_exam_id">
            <SelectValue placeholder={selectableExams.length ? "Select exam" : "All exams already added"} />
          </SelectTrigger>
          <SelectContent>
            {selectableExams.map((exam) => (
              <SelectItem key={exam.id} value={exam.id}>
                {exam.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings_subject">Subject</Label>
        <Select value={subject} onValueChange={setSubject} disabled={!availableSubjects.length}>
          <SelectTrigger id="settings_subject">
            <SelectValue placeholder={availableSubjects.length ? "Select subject" : "No subject left for this exam"} />
          </SelectTrigger>
          <SelectContent>
            {availableSubjects.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="exam_slug" value={selectedExam?.slug ?? ""} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="selection_ready" value={disabled ? "" : "1"} />
    </div>
  );
}
