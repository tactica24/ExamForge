type AccessProfile = {
  subscription_tier?: string | null;
  pro_until?: string | null;
} | null | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;

function getTier(profile: AccessProfile) {
  return String(profile?.subscription_tier ?? "").trim().toLowerCase();
}

function parseTimedAccess(profile: AccessProfile) {
  if (!profile?.pro_until) return null;
  const expiresAt = new Date(String(profile.pro_until)).getTime();
  if (!Number.isFinite(expiresAt)) return null;
  if (expiresAt <= Date.now()) return null;
  return new Date(expiresAt);
}

export function hasActiveProAccess(profile: AccessProfile) {
  return getTier(profile) === "pro" || Boolean(parseTimedAccess(profile));
}

export function isFreeTrialActive(profile: AccessProfile) {
  return getTier(profile) !== "pro" && Boolean(parseTimedAccess(profile));
}

export function getTimedAccessEndsAt(profile: AccessProfile) {
  return parseTimedAccess(profile);
}

export function getTimedAccessDaysRemaining(profile: AccessProfile) {
  const expiresAt = parseTimedAccess(profile);
  if (!expiresAt) return 0;
  return Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS));
}
