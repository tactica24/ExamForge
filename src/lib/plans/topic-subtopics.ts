import "server-only";

function normalizeTopicKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseFocusedSubtopics(title: string) {
  const match = String(title ?? "").match(/\(\s*focus\s*:\s*([^)]+)\)\s*$/i);
  if (!match?.[1]) return [];

  return match[1]
    .split(/\s*(?:\+|,|;|\|)\s*/)
    .map((entry) => String(entry ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function stripFocusSuffix(value: string) {
  return String(value ?? "").replace(/\(\s*focus\s*:[^)]+\)\s*$/i, "").trim();
}

export function findTopicSubtopics(topics: unknown, topicPath: string, title: string): string[] {
  const focusedSubtopics = parseFocusedSubtopics(title);
  if (focusedSubtopics.length) return focusedSubtopics;

  if (!Array.isArray(topics)) return [];
  const targetPath = normalizeTopicKey(stripFocusSuffix(topicPath));
  const targetTitle = normalizeTopicKey(stripFocusSuffix(title));

  const match = topics.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    const pathKey = normalizeTopicKey(row.path);
    const titleKey = normalizeTopicKey(row.title);
    return pathKey === targetPath || titleKey === targetPath || pathKey === targetTitle || titleKey === targetTitle;
  });

  if (!match || typeof match !== "object") return [];
  const subtopics = (match as Record<string, unknown>).subtopics;
  if (!Array.isArray(subtopics)) return [];

  return subtopics
    .map((entry) =>
      String(entry ?? "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 8);
}
