import "server-only";

import { z } from "zod";

const ServerEnvSchema = z.object({
  APP_BACKEND_PROVIDER: z.enum(["aws"]).optional(),
  ADMIN_EMAILS: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),
  COGNITO_REGION: z.string().min(1).optional(),
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_APP_CLIENT_ID: z.string().min(1).optional(),
  COGNITO_APP_CLIENT_SECRET: z.string().min(1).optional(),
  COGNITO_DOMAIN: z.string().min(1).optional(),
  COGNITO_CALLBACK_URL: z.string().url().optional(),
  COGNITO_LOGOUT_URL: z.string().url().optional(),
  COGNITO_GOOGLE_IDP_NAME: z.string().min(1).optional(),
  APP_SESSION_SECRET: z.string().min(32).optional(),
  AURORA_CLUSTER_ARN: z.string().min(1).optional(),
  AURORA_SECRET_ARN: z.string().min(1).optional(),
  AURORA_DATABASE: z.string().min(1).optional(),
  S3_BUCKET_NAME: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
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
  RESEND_FROM_EMAIL: z.string().email().optional(),
  ALLOW_BACKEND_IN_MEMORY_FALLBACK: z.enum(["0", "1"]).optional()
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

function normalizeEmailList(value: string | undefined) {
  return String(value ?? "")
    .split(/[,\n;]+/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
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
    APP_BACKEND_PROVIDER: parsed.data.APP_BACKEND_PROVIDER ?? "aws",
    ADMIN_EMAILS: normalizeEmailList(parsed.data.ADMIN_EMAILS),
    NEXT_PUBLIC_APP_URL: normalizeHttpUrl(parsed.data.NEXT_PUBLIC_APP_URL),
    COGNITO_CALLBACK_URL: normalizeHttpUrl(parsed.data.COGNITO_CALLBACK_URL),
    COGNITO_LOGOUT_URL: normalizeHttpUrl(parsed.data.COGNITO_LOGOUT_URL),
    S3_PUBLIC_BASE_URL: normalizeHttpUrl(parsed.data.S3_PUBLIC_BASE_URL),
    OPENAI_API_KEY: parsed.data.OPENAI_API_KEY ?? parsed.data.openai_api_key,
    GROQ_API_KEY: parsed.data.GROQ_API_KEY ?? parsed.data.groq_api_key,
    GEMINI_API_KEY: parsed.data.GEMINI_API_KEY ?? parsed.data.gemini_api_key
  };
}
