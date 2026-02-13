import "server-only";

import { getServerEnv } from "@/lib/env";

export type Channel = "in_app" | "sms" | "whatsapp" | "email";

function basicAuth(user: string, pass: string) {
  return Buffer.from(`${user}:${pass}`).toString("base64");
}

function toWhatsApp(n: string) {
  return n.startsWith("whatsapp:") ? n : `whatsapp:${n}`;
}

export async function sendViaProvider(args: {
  channel: Channel;
  to: { phone?: string | null; email?: string | null };
  message: string;
}) {
  const env = getServerEnv();

  if (args.channel === "in_app") return { ok: true, provider: "in_app" as const };

  if (args.channel === "sms") {
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER && args.to.phone) {
      try {
        const body = new URLSearchParams();
        body.set("To", args.to.phone);
        body.set("From", env.TWILIO_FROM_NUMBER);
        body.set("Body", args.message);

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${basicAuth(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body
          }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, provider: "twilio_sms", error: json?.message ?? "twilio_error" };
        return { ok: true, provider: "twilio_sms" as const, sid: json?.sid, status: json?.status };
      } catch (e: any) {
        return { ok: false, provider: "twilio_sms", error: e?.message ?? "twilio_error" };
      }
    }
    return { ok: false, provider: "sms_unconfigured" as const };
  }

  if (args.channel === "email") {
    if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL && args.to.email) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL,
            to: [args.to.email],
            subject: "ExamForge reminder",
            text: args.message
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, provider: "resend", error: json?.message ?? "resend_error" };
        return { ok: true, provider: "resend" as const, id: json?.id };
      } catch (e: any) {
        return { ok: false, provider: "resend", error: e?.message ?? "resend_error" };
      }
    }
    return { ok: false, provider: "email_unconfigured" as const };
  }

  if (args.channel === "whatsapp") {
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER && args.to.phone) {
      try {
        const body = new URLSearchParams();
        body.set("To", toWhatsApp(args.to.phone));
        body.set("From", toWhatsApp(env.TWILIO_FROM_NUMBER));
        body.set("Body", args.message);

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${basicAuth(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body
          }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, provider: "twilio_whatsapp", error: json?.message ?? "twilio_error" };
        return { ok: true, provider: "twilio_whatsapp" as const, sid: json?.sid, status: json?.status };
      } catch (e: any) {
        return { ok: false, provider: "twilio_whatsapp", error: e?.message ?? "twilio_error" };
      }
    }
    return { ok: false, provider: "whatsapp_unconfigured" as const };
  }

  return { ok: false, provider: "unknown" as const };
}
