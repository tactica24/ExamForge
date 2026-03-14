const DAY_MS = 24 * 60 * 60 * 1000;

export const FREE_TRIAL_DAYS = 3;
export const PRO_PLAN_DAYS = 30;

export type BillingAccessProfile = {
  subscription_tier?: string | null;
  pro_until?: string | null;
  created_at?: string | null;
};

export type BillingAccessState = {
  status: "trial" | "pro" | "free";
  hasActivePro: boolean;
  isInFreeTrial: boolean;
  canUseFullFeatures: boolean;
  requiresUpgrade: boolean;
  trialEndsAt: string | null;
  proEndsAt: string | null;
  canAccessHistory: boolean;
  canAccessTests: boolean;
  canAccessMockExams: boolean;
};

function cleanTier(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parseTimestamp(value: string | Date | null | undefined) {
  if (!value) return Number.NaN;
  const date = value instanceof Date ? value : new Date(String(value));
  return date.getTime();
}

function toIsoOrNull(value: number) {
  return Number.isFinite(value) ? new Date(value).toISOString() : null;
}

export function computeRollingProUntil(args?: {
  startsAt?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
  durationDays?: number;
}) {
  const durationDays = Math.max(1, Math.trunc(args?.durationDays ?? PRO_PLAN_DAYS));
  const startMs = parseTimestamp(args?.startsAt ?? null);
  const currentEndMs = parseTimestamp(args?.currentPeriodEnd ?? null);
  const baseMs =
    Number.isFinite(currentEndMs) && currentEndMs > startMs ? currentEndMs : Number.isFinite(startMs) ? startMs : Date.now();

  return new Date(baseMs + durationDays * DAY_MS).toISOString();
}

export function getBillingAccess(profile: BillingAccessProfile | null | undefined, now = new Date()): BillingAccessState {
  const nowMs = now.getTime();
  const tier = cleanTier(profile?.subscription_tier);
  const proEndsAtMs = parseTimestamp(profile?.pro_until ?? null);
  const hasExplicitProWindow = Number.isFinite(proEndsAtMs);
  const hasActivePro = hasExplicitProWindow ? proEndsAtMs > nowMs : tier === "pro";

  const createdAtMs = parseTimestamp(profile?.created_at ?? null);
  const trialEndsAtMs = Number.isFinite(createdAtMs) ? createdAtMs + FREE_TRIAL_DAYS * DAY_MS : Number.NaN;
  const isInFreeTrial = !hasActivePro && Number.isFinite(trialEndsAtMs) && trialEndsAtMs > nowMs;
  const canUseFullFeatures = hasActivePro || isInFreeTrial;

  return {
    status: hasActivePro ? "pro" : isInFreeTrial ? "trial" : "free",
    hasActivePro,
    isInFreeTrial,
    canUseFullFeatures,
    requiresUpgrade: !canUseFullFeatures,
    trialEndsAt: toIsoOrNull(trialEndsAtMs),
    proEndsAt: toIsoOrNull(proEndsAtMs),
    canAccessHistory: true,
    canAccessTests: true,
    canAccessMockExams: true
  };
}

export function hasActiveProAccess(profile: BillingAccessProfile | null | undefined, now = new Date()) {
  return getBillingAccess(profile, now).hasActivePro;
}

export function isInFreeTrial(profile: BillingAccessProfile | null | undefined, now = new Date()) {
  return getBillingAccess(profile, now).isInFreeTrial;
}

export function canUseFullAppFeatures(profile: BillingAccessProfile | null | undefined, now = new Date()) {
  return getBillingAccess(profile, now).canUseFullFeatures;
}
