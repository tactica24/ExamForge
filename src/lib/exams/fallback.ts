import type { Database, Json } from "@/lib/firebase/database.types";
import { seedExamsNG } from "@/data/seed/exams";

export type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

export function getFallbackExams(): ExamRow[] {
  const now = new Date().toISOString();
  return seedExamsNG.map((e) => ({
    id: `fallback-${e.slug}`,
    slug: e.slug,
    name: e.name,
    country_code: e.country_code,
    description: e.description,
    subjects: e.subjects as unknown as Json,
    syllabus_sources: e.syllabus_sources as unknown as Json,
    is_active: true,
    created_at: now
  }));
}

