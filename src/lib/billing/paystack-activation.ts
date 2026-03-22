import "server-only";

import { addDays } from "date-fns";
import type { FirebaseDataClient } from "@/lib/firebase/data-client";
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

function parseFutureIso(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function activateProSubscriptionFromPaystack(args: {
  firebase: Pick<FirebaseDataClient, "from">;
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
  const paidAtDate = parseFutureIso(paidAt) ?? new Date();

  const { data: existingProfile } = await args.firebase
    .from("profiles")
    .select("user_id,pro_until")
    .eq("user_id", userId)
    .maybeSingle();

  const existingExpiry = parseFutureIso((existingProfile as any)?.pro_until);
  const anchor = existingExpiry && existingExpiry.getTime() > paidAtDate.getTime() ? existingExpiry : paidAtDate;
  const nextPeriodEnd = addDays(anchor, 30).toISOString();

  const subResult = await args.firebase.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: "paystack",
      tier: "pro",
      status: "active",
      current_period_end: nextPeriodEnd,
      paystack_reference: reference,
      paystack_paid_at: paidAt
    },
    { onConflict: "user_id,provider" }
  );
  if (subResult.error) {
    return { ok: false, reason: "db_error", message: subResult.error.message };
  }

  const profileResult = await args.firebase.from("profiles").upsert(
    {
      user_id: userId,
      subscription_tier: "pro",
      pro_until: nextPeriodEnd
    },
    { onConflict: "user_id" }
  );
  if (profileResult.error) {
    return { ok: false, reason: "db_error", message: profileResult.error.message };
  }

  await args.firebase.from("billing_events").upsert(
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
    reference
  };
}
