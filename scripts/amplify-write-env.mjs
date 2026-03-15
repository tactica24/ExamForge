import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_APP_URL",
  "APP_WEB_URL",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
  "OPENAI_API_KEY",
  "openai_api_key",
  "GROQ_API_KEY",
  "groq_api_key",
  "GEMINI_API_KEY",
  "gemini_api_key",
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_PUBLIC_KEY",
  "PAYSTACK_CALLBACK_URL",
  "APP_CRON_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "AFRICASTALKING_USERNAME",
  "AFRICASTALKING_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ALLOW_FIRESTORE_IN_MEMORY_FALLBACK"
];

function quoteEnvValue(value) {
  return JSON.stringify(String(value ?? ""));
}

const lines = [];

for (const key of ALLOWED_KEYS) {
  if (!(key in process.env)) continue;
  const value = process.env[key];
  if (value == null || value === "") continue;
  lines.push(`${key}=${quoteEnvValue(value)}`);
}

const outputPath = resolve(".env.production");
writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${lines.length} environment variables to ${outputPath}`);
