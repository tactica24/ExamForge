#!/usr/bin/env node

function normalizeHttpUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const candidate = raw.includes("://") ? raw : `https://${raw}`;

  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

const appUrl = normalizeHttpUrl(process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_WEB_URL ?? "");

const required = [
  "COGNITO_REGION",
  "COGNITO_USER_POOL_ID",
  "COGNITO_APP_CLIENT_ID",
  "COGNITO_DOMAIN",
  "APP_SESSION_SECRET",
  "AURORA_CLUSTER_ARN",
  "AURORA_SECRET_ARN",
  "AURORA_DATABASE",
  "S3_BUCKET_NAME",
  "S3_REGION"
];

const missing = required.filter((key) => !String(process.env[key] ?? "").trim());

if (!appUrl) {
  missing.push("NEXT_PUBLIC_APP_URL or APP_WEB_URL");
}

if (missing.length) {
  console.error("Missing required AWS deployment variables:");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

const derived = {
  APP_BACKEND_PROVIDER: "aws",
  NEXT_PUBLIC_APP_URL: appUrl,
  APP_WEB_URL: normalizeHttpUrl(process.env.APP_WEB_URL ?? appUrl) || appUrl,
  COGNITO_CALLBACK_URL:
    normalizeHttpUrl(process.env.COGNITO_CALLBACK_URL) || `${appUrl}/api/auth/cognito/callback`,
  COGNITO_LOGOUT_URL: normalizeHttpUrl(process.env.COGNITO_LOGOUT_URL) || `${appUrl}/login`,
  PAYSTACK_CALLBACK_URL: normalizeHttpUrl(process.env.PAYSTACK_CALLBACK_URL) || `${appUrl}/billing/callback`,
  S3_PUBLIC_BASE_URL:
    normalizeHttpUrl(process.env.S3_PUBLIC_BASE_URL) ||
    `https://${String(process.env.S3_BUCKET_NAME ?? "").trim()}.s3.${String(process.env.S3_REGION ?? "").trim()}.amazonaws.com`
};

console.log("AWS deployment env looks ready.");
for (const [key, value] of Object.entries(derived)) {
  console.log(`${key}=${value}`);
}
