import type { Json } from "@/lib/backend/database.types";

export type QuizReviewFeedbackMap = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function getQuizReviewFeedback(meta: unknown): QuizReviewFeedbackMap {
  if (!isRecord(meta) || !isRecord(meta.review_feedback)) return {};

  const out: QuizReviewFeedbackMap = {};
  for (const [questionId, text] of Object.entries(meta.review_feedback)) {
    const id = cleanText(questionId, 120);
    const value = cleanText(text, 1600);
    if (!id || !value) continue;
    out[id] = value;
  }

  return out;
}

export function withQuizReviewFeedback(meta: unknown, feedback: QuizReviewFeedbackMap): Json {
  const base = isRecord(meta) ? meta : {};
  return {
    ...base,
    review_feedback: getQuizReviewFeedback({ review_feedback: feedback })
  } as Json;
}
