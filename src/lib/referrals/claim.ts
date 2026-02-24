import "server-only";

import { addDays } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";

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

function isConflictMessage(value: unknown) {
  const message = String(value ?? "").toLowerCase();
  return message.includes("duplicate") || message.includes("already exists") || message.includes("unique");
}

async function extendProAccess(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  bonusDays: number;
}) {
  const { data: profile } = await args.firebase
    .from("profiles")
    .select("subscription_tier,pro_until")
    .eq("user_id", args.userId)
    .maybeSingle();

  const now = new Date();
  const existing = profile?.pro_until ? new Date(profile.pro_until) : null;
  const base = existing && existing > now ? existing : now;
  const next = addDays(base, Math.max(1, Math.trunc(args.bonusDays || 1))).toISOString();

  await args.firebase
    .from("profiles")
    .update({
      subscription_tier: "pro",
      pro_until: next
    })
    .eq("user_id", args.userId);

  await args.firebase.from("subscriptions").upsert(
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
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  email: string | null;
  phone: string | null;
}) {
  const candidateUserIds = new Set<string>();

  if (args.email) {
    const { data: emailProfiles } = await args.firebase
      .from("profiles")
      .select("user_id")
      .eq("email", args.email);
    for (const row of emailProfiles ?? []) {
      const id = String((row as any)?.user_id ?? "").trim();
      if (id) candidateUserIds.add(id);
    }
  }

  if (args.phone) {
    const { data: phoneProfiles } = await args.firebase
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

  const { data: existingReferrals } = await args.firebase
    .from("referrals")
    .select("invitee_user_id")
    .in("invitee_user_id", ids);

  return Boolean(
    (existingReferrals ?? []).some((row: any) => String(row?.invitee_user_id ?? "").trim() !== args.userId)
  );
}

export async function claimReferralForUser(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  code: string;
  bonusDays?: number;
}) {
  const code = normalizeCode(args.code);
  if (!code) return { applied: false as const, reason: "missing_code" };

  const bonusDays = Math.max(1, Math.trunc(args.bonusDays ?? 3));

  const { data: existingInvitee } = await args.firebase
    .from("referrals")
    .select("id")
    .eq("invitee_user_id", args.userId)
    .maybeSingle();
  if (existingInvitee?.id) {
    return { applied: false as const, reason: "already_claimed" };
  }

  const { data: inviterCode } = await args.firebase
    .from("referral_codes")
    .select("user_id,code")
    .eq("code", code)
    .maybeSingle();
  if (!inviterCode?.user_id) {
    return { applied: false as const, reason: "invalid_code" };
  }

  if (inviterCode.user_id === args.userId) {
    return { applied: false as const, reason: "self_referral" };
  }

  const { data: inviteeProfile } = await args.firebase
    .from("profiles")
    .select("email,phone")
    .eq("user_id", args.userId)
    .maybeSingle();

  const email = normalizeEmail(inviteeProfile?.email ?? null);
  const phone = normalizePhone(inviteeProfile?.phone ?? null);

  const alreadyRewardedIdentity = await identityAlreadyRewarded({
    firebase: args.firebase,
    userId: args.userId,
    email,
    phone
  });
  if (alreadyRewardedIdentity) {
    return { applied: false as const, reason: "identity_already_rewarded" };
  }

  const { error: insertError } = await args.firebase.from("referrals").insert({
    inviter_user_id: inviterCode.user_id,
    invitee_user_id: args.userId,
    code
  });

  if (insertError) {
    if (isConflictMessage(insertError.message)) {
      return { applied: false as const, reason: "already_claimed" };
    }
    return { applied: false as const, reason: "insert_failed", message: insertError.message };
  }

  await Promise.allSettled([
    extendProAccess({
      firebase: args.firebase,
      userId: args.userId,
      bonusDays
    }),
    extendProAccess({
      firebase: args.firebase,
      userId: inviterCode.user_id,
      bonusDays
    })
  ]);

  return {
    applied: true as const,
    inviterUserId: inviterCode.user_id
  };
}
