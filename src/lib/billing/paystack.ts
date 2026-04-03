import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";

export type PaystackInitResponse = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type PaystackVerificationData = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
  customer?: {
    email?: string | null;
  } | null;
};

export const PAYSTACK_PRO_MONTHLY_AMOUNT_NAIRA = 1000;
export const PAYSTACK_PRO_MONTHLY_AMOUNT_KOBO = PAYSTACK_PRO_MONTHLY_AMOUNT_NAIRA * 100;
export const PAYSTACK_PRO_MONTHLY_PRICE_LABEL = `N${PAYSTACK_PRO_MONTHLY_AMOUNT_NAIRA.toLocaleString("en-NG")}`;

function equalsHex(left: string, right: string) {
  const a = String(left ?? "").trim().toLowerCase();
  const b = String(right ?? "").trim().toLowerCase();
  if (!a || !b) return false;

  try {
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");
    if (aBuf.length === 0 || bBuf.length === 0) return false;
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export async function paystackInitialize(args: {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  metadata: Record<string, any>;
}) {
  const env = getServerEnv();
  if (!env.PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY is not set.");

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: args.email,
      amount: args.amountKobo,
      callback_url: args.callbackUrl,
      metadata: args.metadata
    })
  });

  const json = await res.json();
  if (!res.ok || !json?.status) {
    throw new Error(json?.message ?? "Paystack initialize failed.");
  }
  return json.data as PaystackInitResponse;
}

export async function paystackVerify(reference: string) {
  const env = getServerEnv();
  if (!env.PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY is not set.");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` }
  });
  const json = await res.json();
  if (!res.ok || !json?.status) {
    throw new Error(json?.message ?? "Paystack verify failed.");
  }
  return json.data as PaystackVerificationData;
}

export function verifyPaystackWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const env = getServerEnv();
  if (!env.PAYSTACK_SECRET_KEY) return false;

  const expected = createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  return equalsHex(expected, signatureHeader ?? "");
}

