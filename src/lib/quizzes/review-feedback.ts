import "server-only";

import type { Json } from "@/lib/firebase/database.types";

export type ReviewFeedbackMap = Record<string, string>;

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeFeedbackMap(value: unknown): ReviewFeedbackMap {
  const source = asObject(value);
  if (!source) return {};

  const entries = Object.entries(source)
    .map(([key, text]) => [String(key).trim(), String(text ?? "").trim()] as const)
    .filter(([key, text]) => key.length > 0 && text.length > 0);

  return Object.fromEntries(entries);
}

export function getStoredReviewFeedback(meta: unknown): ReviewFeedbackMap {
  const root = asObject(meta);
  if (!root) return {};

  const reviewFeedback = asObject(root.review_feedback);
  if (!reviewFeedback) return {};

  if (reviewFeedback.answers) {
    return normalizeFeedbackMap(reviewFeedback.answers);
  }

  return normalizeFeedbackMap(reviewFeedback);
}

export function mergeStoredReviewFeedback(meta: unknown, answers: ReviewFeedbackMap): Json {
  const root = asObject(meta) ?? {};
  const existing = getStoredReviewFeedback(root);
  const merged = {
    ...existing,
    ...normalizeFeedbackMap(answers)
  };

  return {
    ...root,
    review_feedback: {
      answers: merged,
      updated_at: new Date().toISOString()
    }
  } as Json;
}
