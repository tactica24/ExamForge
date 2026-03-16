#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error("Usage: node scripts/firebase-env-from-service-account.mjs <service-account-json-path>");
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), jsonPath);

if (!fs.existsSync(absolutePath)) {
  console.error(`File not found: ${absolutePath}`);
  process.exit(1);
}

let raw = "";
let parsed = null;

try {
  raw = fs.readFileSync(absolutePath, "utf8");
  parsed = JSON.parse(raw);
} catch (error) {
  console.error("Failed to read or parse service account JSON.");
  process.exit(1);
}

const requiredKeys = ["project_id", "client_email", "private_key"];
const missing = requiredKeys.filter((key) => !parsed?.[key]);
if (missing.length) {
  console.error(`Missing required fields in service account JSON: ${missing.join(", ")}`);
  process.exit(1);
}

const projectId = String(parsed.project_id);
const storageBucket = parsed.storage_bucket
  ? String(parsed.storage_bucket)
  : `${projectId}.appspot.com`;

const normalizedRaw = JSON.stringify(parsed);
const base64 = Buffer.from(normalizedRaw, "utf8").toString("base64");
const privateKeyEscaped = String(parsed.private_key).replace(/\n/g, "\\n");

console.log("# Paste these into your Vercel environment variables");
console.log(`NEXT_PUBLIC_FIREBASE_PROJECT_ID=${projectId}`);
console.log(`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${projectId}.firebaseapp.com`);
console.log(`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${storageBucket}`);
console.log("NEXT_PUBLIC_FIREBASE_API_KEY=<from Firebase Web app config>");
console.log("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from Firebase Web app config>");
console.log("NEXT_PUBLIC_FIREBASE_APP_ID=<from Firebase Web app config>");
console.log("NEXT_PUBLIC_APP_URL=https://ace-naija.com");
console.log("APP_WEB_URL=https://ace-naija.com");
console.log(`FIREBASE_PROJECT_ID=${projectId}`);
console.log(`FIREBASE_CLIENT_EMAIL=${parsed.client_email}`);
console.log(`FIREBASE_PRIVATE_KEY=${privateKeyEscaped}`);
console.log(`FIREBASE_STORAGE_BUCKET=${storageBucket}`);
console.log(`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=${base64}`);
