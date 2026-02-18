#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function usage() {
  console.log("Usage:");
  console.log("  npm run firebase:role:set -- <service-account-json-path> <user-email> <role>");
  console.log("");
  console.log("Role values:");
  console.log("  admin  -> grants admin access");
  console.log("  user   -> removes admin access");
}

const serviceAccountPathArg = process.argv[2];
const emailArg = process.argv[3];
const roleArg = (process.argv[4] ?? "admin").toLowerCase();

if (!serviceAccountPathArg || !emailArg) {
  usage();
  process.exit(1);
}

if (!["admin", "user"].includes(roleArg)) {
  console.error(`Invalid role: ${roleArg}`);
  usage();
  process.exit(1);
}

const serviceAccountPath = path.resolve(process.cwd(), serviceAccountPathArg);
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account file not found: ${serviceAccountPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(serviceAccountPath, "utf8");
let serviceAccount;

try {
  serviceAccount = JSON.parse(raw);
} catch {
  console.error("Invalid JSON in service account file.");
  process.exit(1);
}

if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
  console.error("Service account JSON is missing required fields.");
  process.exit(1);
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: String(serviceAccount.private_key).replace(/\\n/g, "\n")
    }),
    projectId: serviceAccount.project_id
  });

const auth = getAuth(app);

try {
  const user = await auth.getUserByEmail(emailArg);
  const claims = { ...(user.customClaims ?? {}) };
  claims.role = roleArg;

  await auth.setCustomUserClaims(user.uid, claims);
  await auth.revokeRefreshTokens(user.uid);

  console.log(`Updated role for ${emailArg}`);
  console.log(`uid: ${user.uid}`);
  console.log(`role: ${roleArg}`);
  console.log("User should log out and log in again to refresh session claims.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Failed to set role.";
  console.error(message);
  process.exit(1);
}
