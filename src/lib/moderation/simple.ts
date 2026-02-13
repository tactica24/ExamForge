import "server-only";

const BANNED = [/hate/i, /kill yourself/i, /nude/i, /porn/i, /scam/i];

export function simpleModerate(text: string) {
  const trimmed = text.trim();
  const flagged = BANNED.some((re) => re.test(trimmed));
  return { ok: trimmed.length > 0 && trimmed.length <= 2000, flagged };
}

