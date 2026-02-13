import type { Json } from "@/lib/supabase/database.types";
import { seedSyllabiNG } from "@/data/seed/exams";

export type Topic = {
  title: string;
  path: string;
  subtopics?: string[];
  resources?: Array<{ title: string; url: string }>;
};

export function getFallbackTopics(examSlug: string, subject: string): Topic[] | null {
  const match = seedSyllabiNG.find(
    (s) => s.exam_slug.toLowerCase() === examSlug.toLowerCase() && s.subject === subject
  );
  return match?.topics ?? null;
}

export function topicsToJson(topics: Topic[]): Json {
  return topics as unknown as Json;
}

