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

const MAX_SUBJECTS = 7;

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
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!selectableExams.length) {
      if (examId) setExamId("");
      return;
    }
    if (!selectableExams.some((exam) => exam.id === examId)) {
      setExamId(selectableExams[0]?.id ?? "");
    }
  }, [selectableExams, examId]);

  const availableSubjects = React.useMemo(() => {
    if (!examId) return [];
    return (subjectsByExamId.get(examId) ?? []).filter((subject) => !selectedSet.has(`${examId}::${subject}`));
  }, [examId, selectedSet, subjectsByExamId]);

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

  const selectedExam = selectableExams.find((exam) => exam.id === examId);
  const disabled = !selectableExams.length || !availableSubjects.length;

  if (!selectableExams.length) {
    return (
      <div className="space-y-2 sm:col-span-2">
        <input type="hidden" name="exam_id" value="" />
        <input type="hidden" name="exam_slug" value="" />
        <p className="text-sm text-muted-foreground">
          You have already added all available exam-subject combinations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
        <Label>{selectedExam?.name ?? "Exam"} subjects</Label>
        {availableSubjects.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {availableSubjects.map((subject) => {
              const checked = selectedSubjects.includes(subject);
              const subjectDisabled = !checked && selectedSubjects.length >= MAX_SUBJECTS;

              return (
                <label
                  key={subject}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border/70 bg-card"
                  } ${subjectDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    name="subjects"
                    className="mt-1 h-4 w-4 accent-black"
                    value={subject}
                    checked={checked}
                    disabled={subjectDisabled}
                    onChange={() => toggleSubject(subject)}
                  />
                  <div className="text-sm font-medium">{subject}</div>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No subjects left for this exam.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Selected: {selectedSubjects.length}/{MAX_SUBJECTS}
        </p>
      </div>

      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="exam_slug" value={selectedExam?.slug ?? ""} />
      <input type="hidden" name="selection_ready" value={!disabled && selectedSubjects.length ? "1" : ""} />
    </div>
  );
}
