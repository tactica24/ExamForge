import "server-only";

import { z } from "zod";

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),
  APP_WEB_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1).optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  openai_api_key: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  groq_api_key: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  gemini_api_key: z.string().min(1).optional(),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  PAYSTACK_PUBLIC_KEY: z.string().min(1).optional(),
  PAYSTACK_CALLBACK_URL: z.string().url().optional(),
  APP_CRON_SECRET: z.string().min(12).optional(),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_FROM_NUMBER: z.string().min(1).optional(),
  AFRICASTALKING_USERNAME: z.string().min(1).optional(),
  AFRICASTALKING_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional()
});

function normalizeHttpUrl(value: string | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  const candidate = raw.includes("://") ? raw : `https://${raw}`;

  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function getServerEnv() {
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Missing/invalid environment variables:\n${message}`);
  }

  return {
    ...parsed.data,
    NEXT_PUBLIC_APP_URL: normalizeHttpUrl(parsed.data.NEXT_PUBLIC_APP_URL),
    APP_WEB_URL: normalizeHttpUrl(parsed.data.APP_WEB_URL),
    OPENAI_API_KEY: parsed.data.OPENAI_API_KEY ?? parsed.data.openai_api_key,
    GROQ_API_KEY: parsed.data.GROQ_API_KEY ?? parsed.data.groq_api_key,
    GEMINI_API_KEY: parsed.data.GEMINI_API_KEY ?? parsed.data.gemini_api_key
  };
}
