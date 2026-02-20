import type { Json } from "@/lib/firebase/database.types";

export type PlanResourceLink = {
  title: string;
  url: string;
};

export type PlanLessonSection = {
  heading: string;
  explanation: string;
};

export type PlanLessonExample = {
  question: string;
  walkthrough: string;
  answer: string;
};

export type PlanLesson = {
  overview: string;
  breakdown: PlanLessonSection[];
  examples: PlanLessonExample[];
  common_mistakes: string[];
  recap: string[];
  generated_at: string;
  source: "ai" | "fallback";
  provider: string | null;
  model: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeIsoDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function normalizeResourceLink(value: unknown): PlanResourceLink | null {
  if (!isRecord(value)) return null;
  const title = cleanText(value.title, 120);
  const url = cleanText(value.url, 600);
  if (!title || !/^https?:\/\//i.test(url)) return null;
  return { title, url };
}

function normalizeStringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeSection(value: unknown): PlanLessonSection | null {
  if (!isRecord(value)) return null;
  const heading = cleanText(value.heading, 90);
  const explanation = cleanText(value.explanation, 900);
  if (!heading || !explanation) return null;
  return { heading, explanation };
}

function normalizeExample(value: unknown): PlanLessonExample | null {
  if (!isRecord(value)) return null;
  const question = cleanText(value.question, 320);
  const walkthrough = cleanText(value.walkthrough, 900);
  const answer = cleanText(value.answer, 300);
  if (!question || !walkthrough || !answer) return null;
  return { question, walkthrough, answer };
}

export function getPlanItemResourceLinks(value: unknown): PlanResourceLink[] {
  const raw = Array.isArray(value) ? value : isRecord(value) ? value.resources : [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => normalizeResourceLink(entry)).filter(Boolean) as PlanResourceLink[];
}

export function normalizePlanLesson(value: unknown): PlanLesson | null {
  if (!isRecord(value)) return null;

  const overview = cleanText(value.overview, 1200);
  const breakdown = Array.isArray(value.breakdown)
    ? value.breakdown.map((entry) => normalizeSection(entry)).filter(Boolean).slice(0, 8)
    : [];
  const examples = Array.isArray(value.examples)
    ? value.examples.map((entry) => normalizeExample(entry)).filter(Boolean).slice(0, 4)
    : [];
  const commonMistakes = normalizeStringList(value.common_mistakes, 8, 260);
  const recap = normalizeStringList(value.recap, 8, 260);
  const source = value.source === "fallback" ? "fallback" : "ai";
  const providerText = cleanText(value.provider, 80);
  const modelText = cleanText(value.model, 120);

  if (!overview || !breakdown.length || !examples.length || !commonMistakes.length || !recap.length) {
    return null;
  }

  return {
    overview,
    breakdown: breakdown as PlanLessonSection[],
    examples: examples as PlanLessonExample[],
    common_mistakes: commonMistakes,
    recap,
    generated_at: normalizeIsoDate(value.generated_at),
    source,
    provider: providerText || null,
    model: modelText || null
  };
}

export function getPlanItemLesson(value: unknown): PlanLesson | null {
  if (!isRecord(value)) return null;
  return normalizePlanLesson(value.lesson);
}

export function withPlanItemLesson(resourceLinks: unknown, lesson: PlanLesson): Json {
  const base = isRecord(resourceLinks) ? resourceLinks : {};
  const resources = getPlanItemResourceLinks(resourceLinks);

  return {
    ...base,
    resources,
    lesson
  } as Json;
}
