export const NIGERIAN_EXAM_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "Geography",
  "Government",
  "Literature in English",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "History",
  "Financial Accounting",
  "Commerce",
  "Further Mathematics",
  "Civic Education"
] as const;

export function mergeUniqueSubjects(subjects: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const subject of subjects) {
    const clean = String(subject).trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    ordered.push(clean);
  }
  return ordered;
}

export function mergeNigerianAndExamSubjects(examSubjects: string[]) {
  return mergeUniqueSubjects([...NIGERIAN_EXAM_SUBJECTS, ...examSubjects]);
}
