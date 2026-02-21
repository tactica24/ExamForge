export function hasActiveProAccess(profile: {
  subscription_tier?: string | null;
  pro_until?: string | null;
} | null | undefined) {
  const tier = String(profile?.subscription_tier ?? "").trim().toLowerCase();
  if (tier === "pro") return true;

  if (!profile?.pro_until) return false;
  const expiresAt = new Date(String(profile.pro_until)).getTime();
  if (!Number.isFinite(expiresAt)) return false;

  return expiresAt > Date.now();
}
