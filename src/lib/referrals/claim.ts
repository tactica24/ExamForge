import "server-only";

import { createBackendServerClient } from "@/lib/backend/server";
import { computeRollingProUntil } from "@/lib/billing/access";

function normalizeCode(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

function normalizeEmail(value: string | null | undefined) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

function normalizePhone(value: string | null | undefined) {
  const phone = String(value ?? "").replace(/\s+/g, "").trim();
  return phone || null;
}

function normalizeOwnerKind(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "campaign" ? "campaign" : "user";
}

function normalizeCampaignId(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function isConflictMessage(value: unknown) {
  const message = String(value ?? "").toLowerCase();
  return message.includes("duplicate") || message.includes("already exists") || message.includes("unique");
}

async function extendProAccess(args: {
  backend: Awaited<ReturnType<typeof createBackendServerClient>>;
  userId: string;
  bonusDays: number;
}) {
  const { data: profile } = await args.backend
    .from("profiles")
    .select("subscription_tier,pro_until")
    .eq("user_id", args.userId)
    .maybeSingle();

  const next = computeRollingProUntil({
    currentPeriodEnd: profile?.pro_until ?? null,
    durationDays: Math.max(1, Math.trunc(args.bonusDays || 1))
  });

  await args.backend
    .from("profiles")
    .update({
      subscription_tier: "pro",
      pro_until: next
    })
    .eq("user_id", args.userId);

  await args.backend.from("subscriptions").upsert(
    {
      user_id: args.userId,
      provider: "referral",
      tier: "pro",
      status: "active",
      current_period_end: next
    },
    { onConflict: "user_id,provider" }
  );
}

async function identityAlreadyRewarded(args: {
  backend: Awaited<ReturnType<typeof createBackendServerClient>>;
  userId: string;
  email: string | null;
  phone: string | null;
}) {
  const candidateUserIds = new Set<string>();

  if (args.email) {
    const { data: emailProfiles } = await args.backend
      .from("profiles")
      .select("user_id")
      .eq("email", args.email);
    for (const row of emailProfiles ?? []) {
      const id = String((row as any)?.user_id ?? "").trim();
      if (id) candidateUserIds.add(id);
    }
  }

  if (args.phone) {
    const { data: phoneProfiles } = await args.backend
      .from("profiles")
      .select("user_id")
      .eq("phone", args.phone);
    for (const row of phoneProfiles ?? []) {
      const id = String((row as any)?.user_id ?? "").trim();
      if (id) candidateUserIds.add(id);
    }
  }

  const ids = Array.from(candidateUserIds);
  if (!ids.length) return false;

  const { data: existingReferrals } = await args.backend
    .from("referrals")
    .select("invitee_user_id")
    .in("invitee_user_id", ids);

  return Boolean(
    (existingReferrals ?? []).some((row: any) => String(row?.invitee_user_id ?? "").trim() !== args.userId)
  );
}

export async function claimReferralForUser(args: {
  backend: Awaited<ReturnType<typeof createBackendServerClient>>;
  userId: string;
  code: string;
  bonusDays?: number;
}) {
  const code = normalizeCode(args.code);
  if (!code) return { applied: false as const, reason: "missing_code" };

  const bonusDays = Math.max(1, Math.trunc(args.bonusDays ?? 3));

  const { data: existingInvitee } = await args.backend
    .from("referrals")
    .select("id")
    .eq("invitee_user_id", args.userId)
    .maybeSingle();
  if (existingInvitee?.id) {
    return { applied: false as const, reason: "already_claimed" };
  }

  const { data: inviterCode } = await args.backend
    .from("referral_codes")
    .select("user_id,code,owner_kind,is_active,campaign_external_id")
    .eq("code", code)
    .maybeSingle();
  if (!inviterCode?.user_id) {
    return { applied: false as const, reason: "invalid_code" };
  }

  const ownerKind = normalizeOwnerKind((inviterCode as any).owner_kind);
  const isActive = (inviterCode as any).is_active !== false;
  const campaignExternalId = normalizeCampaignId((inviterCode as any).campaign_external_id) || null;

  if (!isActive) {
    return { applied: false as const, reason: "inactive_code" };
  }

  if (ownerKind === "user" && inviterCode.user_id === args.userId) {
    return { applied: false as const, reason: "self_referral" };
  }

  const { data: inviteeProfile } = await args.backend
    .from("profiles")
    .select("email,phone")
    .eq("user_id", args.userId)
    .maybeSingle();

  const email = normalizeEmail(inviteeProfile?.email ?? null);
  const phone = normalizePhone(inviteeProfile?.phone ?? null);

  const alreadyRewardedIdentity = await identityAlreadyRewarded({
    backend: args.backend,
    userId: args.userId,
    email,
    phone
  });
  if (alreadyRewardedIdentity) {
    return { applied: false as const, reason: "identity_already_rewarded" };
  }

  const { error: insertError } = await args.backend.from("referrals").insert({
    inviter_user_id: inviterCode.user_id,
    invitee_user_id: args.userId,
    code,
    owner_kind: ownerKind,
    campaign_external_id: campaignExternalId
  });

  if (insertError) {
    if (isConflictMessage(insertError.message)) {
      return { applied: false as const, reason: "already_claimed" };
    }
    return { applied: false as const, reason: "insert_failed", message: insertError.message };
  }

  const rewardTasks = [
    extendProAccess({
      backend: args.backend,
      userId: args.userId,
      bonusDays
    })
  ];

  if (ownerKind === "user") {
    rewardTasks.push(
      extendProAccess({
        backend: args.backend,
        userId: inviterCode.user_id,
        bonusDays
      })
    );
  }

  await Promise.allSettled(rewardTasks);

  return {
    applied: true as const,
    inviterUserId: ownerKind === "user" ? inviterCode.user_id : null,
    ownerKind,
    campaignExternalId
  };
}

