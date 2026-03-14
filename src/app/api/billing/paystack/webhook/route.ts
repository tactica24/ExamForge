import { NextResponse } from "next/server";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { activateProSubscriptionFromPaystack } from "@/lib/billing/paystack-activation";
import {
  paystackVerify,
  verifyPaystackWebhookSignature
} from "@/lib/billing/paystack";

function parseWebhookBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as {
      event?: string;
      data?: {
        reference?: string;
      };
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, message: "Invalid signature." }, { status: 401 });
  }

  const payload = parseWebhookBody(rawBody);
  if (!payload) {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  if (payload.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: true, reason: "event_not_supported" });
  }

  const reference = String(payload.data?.reference ?? "").trim();
  if (!reference) {
    return NextResponse.json({ ok: false, message: "Missing reference." }, { status: 400 });
  }

  try {
    const verification = await paystackVerify(reference);
    const backend = createBackendAdminClient();
    const activation = await activateProSubscriptionFromPaystack({
      backend,
      verification,
      source: "webhook"
    });

    if (!activation.ok) {
      if (activation.reason === "db_error") {
        return NextResponse.json({ ok: false, message: activation.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        processed: false,
        reason: activation.reason
      });
    }

    return NextResponse.json({ ok: true, processed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
