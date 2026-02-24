export const MIN_TOPICS_PER_DAY = 1;
export const MAX_TOPICS_PER_DAY = 5;

export function parseTopicsPerDay(value: unknown, fallback = 1) {
  const fallbackSafe = Math.max(MIN_TOPICS_PER_DAY, Math.min(MAX_TOPICS_PER_DAY, Math.trunc(fallback || 1)));
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallbackSafe;
  if (raw === "steady") return 1;
  if (raw === "intensive") return 2;

  const matched = raw.match(/(\d{1,2})/);
  if (!matched) return fallbackSafe;

  const numeric = Number(matched[1]);
  if (!Number.isFinite(numeric)) return fallbackSafe;
  return Math.max(MIN_TOPICS_PER_DAY, Math.min(MAX_TOPICS_PER_DAY, Math.trunc(numeric)));
}

export function paceFromTopicsPerDay(value: unknown) {
  const topicsPerDay = parseTopicsPerDay(value, 1);
  if (topicsPerDay <= 1) return "steady";
  if (topicsPerDay === 2) return "intensive";
  return `topics_${topicsPerDay}`;
}

export function describePace(value: unknown) {
  const topicsPerDay = parseTopicsPerDay(value, 1);
  return `${topicsPerDay} topic${topicsPerDay === 1 ? "" : "s"}/day`;
}
