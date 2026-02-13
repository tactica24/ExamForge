"use client";

export type QueuedQuizSubmission = {
  quizId: string;
  answers: number[];
  queuedAt: string;
};

const KEY = "examforge.quizQueue.v1";

export function loadQuizQueue(): QueuedQuizSubmission[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQuizQueue(items: QueuedQuizSubmission[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(-100)));
}

export function enqueueQuizSubmission(item: Omit<QueuedQuizSubmission, "queuedAt">) {
  const items = loadQuizQueue();
  items.push({ ...item, queuedAt: new Date().toISOString() });
  saveQuizQueue(items);
}

export function dequeueSyncedQuizSubmissions(syncedQuizIds: string[]) {
  const set = new Set(syncedQuizIds);
  const next = loadQuizQueue().filter((i) => !set.has(i.quizId));
  saveQuizQueue(next);
  return next;
}

