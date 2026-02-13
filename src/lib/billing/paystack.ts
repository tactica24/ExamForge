import "server-only";

import { getServerEnv } from "@/lib/env";

export type PaystackInitResponse = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

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
  return json.data as any;
}

