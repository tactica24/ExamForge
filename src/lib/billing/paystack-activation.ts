import "server-only";

import type { AppDataClient } from "@/lib/backend/data-client";
import { computeRollingProUntil, PRO_PLAN_DAYS } from "@/lib/billing/access";
import {
  PAYSTACK_PRO_MONTHLY_AMOUNT_KOBO,
  type PaystackVerificationData
} from "@/lib/billing/paystack";

type ActivationSource = "callback" | "webhook";

type ActivationFailureReason =
  | "missing_reference"
  | "payment_not_success"
  | "invalid_amount"
  | "invalid_currency"
  | "missing_metadata_user"
  | "ownership_mismatch"
  | "db_error";

type ActivationResult =
  | {
      ok: true;
      userId: string;
      reference: string;
      proUntil: string;
    }
  | {
      ok: false;
      reason: ActivationFailureReason;
      message: string;
    };

function readMetadataObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function activateProSubscriptionFromPaystack(args: {
  backend: Pick<AppDataClient, "from">;
  verification: PaystackVerificationData;
  source: ActivationSource;
  expectedUserId?: string | null;
}): Promise<ActivationResult> {
  const reference = String(args.verification.reference ?? "").trim();
  if (!reference) {
    return { ok: false, reason: "missing_reference", message: "Missing Paystack reference." };
  }

  if (args.verification.status !== "success") {
    return { ok: false, reason: "payment_not_success", message: "Payment is not successful." };
  }

  const amount = Number(args.verification.amount ?? 0);
  if (!Number.isFinite(amount) || amount < PAYSTACK_PRO_MONTHLY_AMOUNT_KOBO) {
    return { ok: false, reason: "invalid_amount", message: "Invalid payment amount." };
  }

  const currency = String(args.verification.currency ?? "").trim().toUpperCase();
  if (currency && currency !== "NGN") {
    return { ok: false, reason: "invalid_currency", message: "Unsupported payment currency." };
  }

  const metadata = readMetadataObject(args.verification.metadata);
  const userId = String(metadata?.user_id ?? "").trim();
  if (!userId) {
    return { ok: false, reason: "missing_metadata_user", message: "Missing user mapping in payment metadata." };
  }

  if (args.expectedUserId && userId !== args.expectedUserId) {
    return { ok: false, reason: "ownership_mismatch", message: "Payment does not belong to this account." };
  }

  const nowIso = new Date().toISOString();
  const paidAt = String(args.verification.paid_at ?? "").trim() || nowIso;
  const [existingProfileRes, existingSubscriptionRes] = await Promise.all([
    args.backend.from("profiles").select("pro_until").eq("user_id", userId).maybeSingle(),
    args.backend
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", userId)
      .eq("provider", "paystack")
      .maybeSingle()
  ]);
  const nextProUntil = computeRollingProUntil({
    startsAt: paidAt,
    currentPeriodEnd: existingSubscriptionRes.data?.current_period_end ?? existingProfileRes.data?.pro_until ?? null,
    durationDays: PRO_PLAN_DAYS
  });

  const subResult = await args.backend.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: "paystack",
      tier: "pro",
      status: "active",
      current_period_end: nextProUntil,
      paystack_reference: reference,
      paystack_paid_at: paidAt
    },
    { onConflict: "user_id,provider" }
  );
  if (subResult.error) {
    return { ok: false, reason: "db_error", message: subResult.error.message };
  }

  const profileResult = await args.backend.from("profiles").upsert(
    {
      user_id: userId,
      subscription_tier: "pro",
      pro_until: nextProUntil
    },
    { onConflict: "user_id" }
  );
  if (profileResult.error) {
    return { ok: false, reason: "db_error", message: profileResult.error.message };
  }

  await args.backend.from("billing_events").upsert(
    {
      id: `paystack:${reference}`,
      user_id: userId,
      provider: "paystack",
      reference,
      source: args.source,
      status: "success",
      amount_kobo: amount,
      currency: currency || "NGN",
      paid_at: paidAt,
      received_at: nowIso,
      metadata: metadata ?? null
    },
    { onConflict: "id" }
  );

  return {
    ok: true,
    userId,
    reference,
    proUntil: nextProUntil
  };
}
