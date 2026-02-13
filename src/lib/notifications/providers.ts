import "server-only";

import { getServerEnv } from "@/lib/env";

export type Channel = "in_app" | "sms" | "whatsapp" | "email";

export async function sendViaProvider(args: { channel: Channel; to: { phone?: string | null; email?: string | null }; message: string }) {
  const env = getServerEnv();

  if (args.channel === "in_app") return { ok: true, provider: "in_app" as const };

  if (args.channel === "sms") {
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER && args.to.phone) {
      // Keep provider calls as TODO for MVP; insert notifications regardless.
      return { ok: true, provider: "twilio_stub" as const };
    }
    return { ok: false, provider: "sms_unconfigured" as const };
  }

  if (args.channel === "email") {
    if (env.RESEND_API_KEY && args.to.email) {
      return { ok: true, provider: "resend_stub" as const };
    }
    return { ok: false, provider: "email_unconfigured" as const };
  }

  if (args.channel === "whatsapp") {
    // WhatsApp can be via Twilio; keep as stub.
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && args.to.phone) {
      return { ok: true, provider: "twilio_whatsapp_stub" as const };
    }
    return { ok: false, provider: "whatsapp_unconfigured" as const };
  }

  return { ok: false, provider: "unknown" as const };
}

