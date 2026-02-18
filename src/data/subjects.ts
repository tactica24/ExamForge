export const NIGERIAN_EXAM_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Further Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Agricultural Science",
  "Economics",
  "Commerce",
  "Financial Accounting",
  "Government",
  "Civic Education",
  "History",
  "Geography",
  "Literature in English",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "Computer Studies",
  "Data Processing",
  "Technical Drawing",
  "Visual Arts",
  "Music",
  "Home Economics",
  "Food and Nutrition",
  "Business Studies",
  "French",
  "Arabic",
  "Hausa",
  "Igbo",
  "Yoruba"
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
