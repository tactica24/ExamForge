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

export type PlanStudyFormat = "text" | "audio" | "slides";

export type PlanAudioLesson = {
  narration: string;
  generated_at: string;
  source: "ai" | "derived";
  provider: string | null;
  model: string | null;
};

export type PlanSlide = {
  slide_number: number;
  title: string;
  content: string[];
  visual_suggestions: string;
  narration: string;
};

export type PlanSlideDeck = {
  slides: PlanSlide[];
  generated_at: string;
  source: "ai" | "derived";
  provider: string | null;
  model: string | null;
};

export type PlanLessonAssets = {
  selected_format: PlanStudyFormat | null;
  audio: PlanAudioLesson | null;
  slides: PlanSlideDeck | null;
};

export type PlanQuizProgress = {
  completed: boolean;
  completed_at: string | null;
  last_quiz_id: string | null;
  attempts: number;
};

export type PlanProgress = {
  quiz: PlanQuizProgress;
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

function normalizeStudyFormat(value: unknown): PlanStudyFormat | null {
  const format = cleanText(value, 20).toLowerCase();
  if (format === "text" || format === "audio" || format === "slides") return format;
  return null;
}

function normalizeAudioLesson(value: unknown): PlanAudioLesson | null {
  if (!isRecord(value)) return null;

  const narration = cleanText(value.narration, 9000);
  if (!narration) return null;

  const source = value.source === "ai" ? "ai" : "derived";
  const providerText = cleanText(value.provider, 80);
  const modelText = cleanText(value.model, 120);

  return {
    narration,
    generated_at: normalizeIsoDate(value.generated_at),
    source,
    provider: providerText || null,
    model: modelText || null
  };
}

function normalizeSlide(value: unknown): PlanSlide | null {
  if (!isRecord(value)) return null;

  const slideNumber = Math.max(1, Math.min(40, Number(value.slide_number ?? 0)));
  const title = cleanText(value.title, 120);
  const content = Array.isArray(value.content)
    ? value.content.map((item) => cleanText(item, 260)).filter(Boolean).slice(0, 6)
    : [];
  const visualSuggestions = cleanText(value.visual_suggestions, 220);
  const narration = cleanText(value.narration, 1200);

  if (!title || !content.length || !Number.isFinite(slideNumber)) return null;

  return {
    slide_number: slideNumber,
    title,
    content,
    visual_suggestions: visualSuggestions,
    narration
  };
}

function normalizeSlideDeck(value: unknown): PlanSlideDeck | null {
  if (!isRecord(value)) return null;

  const slides = Array.isArray(value.slides)
    ? value.slides.map((entry) => normalizeSlide(entry)).filter(Boolean).slice(0, 10)
    : [];
  if (!slides.length) return null;

  const source = value.source === "ai" ? "ai" : "derived";
  const providerText = cleanText(value.provider, 80);
  const modelText = cleanText(value.model, 120);

  return {
    slides: slides as PlanSlide[],
    generated_at: normalizeIsoDate(value.generated_at),
    source,
    provider: providerText || null,
    model: modelText || null
  };
}

function normalizeLessonAssets(value: unknown): PlanLessonAssets {
  if (!isRecord(value)) {
    return { selected_format: null, audio: null, slides: null };
  }

  const audio = normalizeAudioLesson(value.audio);
  const slides = normalizeSlideDeck(value.slides);
  const selected =
    normalizeStudyFormat(value.selected_format) ?? (slides ? "slides" : audio ? "audio" : null);

  return {
    selected_format: selected,
    audio,
    slides
  };
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

export function getPlanItemLessonAssets(value: unknown): PlanLessonAssets {
  if (!isRecord(value)) return normalizeLessonAssets(null);
  return normalizeLessonAssets(value.assets);
}

function normalizeQuizProgress(value: unknown): PlanQuizProgress {
  if (!isRecord(value)) {
    return { completed: false, completed_at: null, last_quiz_id: null, attempts: 0 };
  }

  const completed = Boolean(value.completed);
  const completedAt = cleanText(value.completed_at, 40);
  const lastQuizId = cleanText(value.last_quiz_id, 120);
  const attempts = Math.max(0, Math.min(999, Number(value.attempts ?? 0)));

  return {
    completed,
    completed_at: completedAt || null,
    last_quiz_id: lastQuizId || null,
    attempts: Number.isFinite(attempts) ? attempts : 0
  };
}

export function getPlanItemProgress(value: unknown): PlanProgress {
  if (!isRecord(value)) return { quiz: normalizeQuizProgress(null) };
  return { quiz: normalizeQuizProgress((value as Record<string, unknown>).progress) };
}

export function isPlanItemQuizCompleted(value: unknown): boolean {
  return getPlanItemProgress(value).quiz.completed;
}

export function withPlanItemProgress(resourceLinks: unknown, progress: PlanProgress): Json {
  const base = isRecord(resourceLinks) ? resourceLinks : {};
  const resources = getPlanItemResourceLinks(resourceLinks);
  const lesson = getPlanItemLesson(resourceLinks);

  return {
    ...base,
    resources,
    ...(lesson ? { lesson } : {}),
    progress
  } as Json;
}

export function withPlanItemLesson(resourceLinks: unknown, lesson: PlanLesson): Json {
  const base = isRecord(resourceLinks) ? resourceLinks : {};
  const resources = getPlanItemResourceLinks(resourceLinks);
  const progress = getPlanItemProgress(resourceLinks);

  return {
    ...base,
    resources,
    lesson,
    progress
  } as Json;
}

export function withPlanItemLessonAssets(resourceLinks: unknown, assets: PlanLessonAssets): Json {
  const base = isRecord(resourceLinks) ? resourceLinks : {};
  const resources = getPlanItemResourceLinks(resourceLinks);
  const lesson = getPlanItemLesson(resourceLinks);
  const progress = getPlanItemProgress(resourceLinks);

  return {
    ...base,
    resources,
    ...(lesson ? { lesson } : {}),
    progress,
    assets: normalizeLessonAssets(assets)
  } as Json;
}
