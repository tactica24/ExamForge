import type { Json } from "@/lib/firebase/database.types";
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

const genericTopicBlueprints = [
  { title: "Foundations", subtopics: ["Core terms", "Basic concepts"] },
  { title: "Key principles", subtopics: ["Rules", "Patterns"] },
  { title: "Methods", subtopics: ["Standard approach", "Worked examples"] },
  { title: "Applications", subtopics: ["Real exam contexts", "Interpretation"] },
  { title: "Frequent mistakes", subtopics: ["Common traps", "How to avoid them"] },
  { title: "Advanced practice", subtopics: ["Mixed questions", "Timed drills"] }
];

export function getGenericTopicsForSubject(subject: string): Topic[] {
  const cleanSubject = String(subject || "Subject").trim();
  return genericTopicBlueprints.map((blueprint) => {
    const query = encodeURIComponent(`${cleanSubject} ${blueprint.title}`);
    return {
      title: `${cleanSubject}: ${blueprint.title}`,
      path: blueprint.title,
      subtopics: blueprint.subtopics,
      resources: [
        { title: "YouTube (search)", url: `https://www.youtube.com/results?search_query=${query}` },
        { title: "Khan Academy (search)", url: `https://www.khanacademy.org/search?page_search_query=${query}` }
      ]
    };
  });
}

export function topicsToJson(topics: Topic[]): Json {
  return topics as unknown as Json;
}

