import "server-only";

import { getServerEnv } from "@/lib/env";

export type Channel = "in_app" | "sms" | "whatsapp" | "email";

function toE164ish(phone: string) {
  return phone.replace(/\s+/g, "");
}

function ensureWhatsAppPrefix(phone: string) {
  const trimmed = phone.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

async function readResponseBody(res: Response) {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      // fall through
    }
  }
  return await res.text();
}

export async function sendViaProvider(args: { channel: Channel; to: { phone?: string | null; email?: string | null }; message: string }) {
  const env = getServerEnv();

  if (args.channel === "in_app") return { ok: true, provider: "in_app" as const };

  if (args.channel === "sms") {
    const phone = args.to.phone ? toE164ish(args.to.phone) : null;

    if (env.AFRICASTALKING_USERNAME && env.AFRICASTALKING_API_KEY && phone) {
      const body = new URLSearchParams();
      body.set("username", env.AFRICASTALKING_USERNAME);
      body.set("to", phone);
      body.set("message", args.message);

      const res = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: env.AFRICASTALKING_API_KEY
        },
        body
      });

      const data = await readResponseBody(res);
      if (!res.ok) return { ok: false, provider: "africastalking" as const, status: res.status, error: data };
      return { ok: true, provider: "africastalking" as const, response: data };
    }

    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER && phone) {
      const body = new URLSearchParams();
      body.set("To", phone);
      body.set("From", env.TWILIO_FROM_NUMBER);
      body.set("Body", args.message);

      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });

      const data = await readResponseBody(res);
      if (!res.ok) return { ok: false, provider: "twilio_sms" as const, status: res.status, error: data };
      const sid = typeof data === "object" && data && "sid" in data ? (data as any).sid : undefined;
      return { ok: true, provider: "twilio_sms" as const, sid, response: data };
    }
    return { ok: false, provider: "sms_unconfigured" as const };
  }

  if (args.channel === "email") {
    const email = args.to.email?.trim() || null;
    if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL && email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL,
          to: [email],
          subject: "ExamForge notification",
          text: args.message
        })
      });

      const data = await readResponseBody(res);
      if (!res.ok) return { ok: false, provider: "resend" as const, status: res.status, error: data };
      const id = typeof data === "object" && data && "id" in data ? (data as any).id : undefined;
      return { ok: true, provider: "resend" as const, id, response: data };
    }
    return { ok: false, provider: "email_unconfigured" as const };
  }

  if (args.channel === "whatsapp") {
    const phone = args.to.phone ? ensureWhatsAppPrefix(toE164ish(args.to.phone)) : null;
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER && phone) {
      const body = new URLSearchParams();
      body.set("To", phone);
      body.set("From", ensureWhatsAppPrefix(env.TWILIO_FROM_NUMBER));
      body.set("Body", args.message);

      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });

      const data = await readResponseBody(res);
      if (!res.ok) return { ok: false, provider: "twilio_whatsapp" as const, status: res.status, error: data };
      const sid = typeof data === "object" && data && "sid" in data ? (data as any).sid : undefined;
      return { ok: true, provider: "twilio_whatsapp" as const, sid, response: data };
    }
    return { ok: false, provider: "whatsapp_unconfigured" as const };
  }

  return { ok: false, provider: "unknown" as const };
}

