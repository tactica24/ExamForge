import "server-only";

import { Buffer } from "node:buffer";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type CredentialConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
};

let firebaseAdminApp: App | null | undefined;
let cachedCredentialConfig: CredentialConfig | null | undefined;

function toPrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

function parseServiceAccountJson(raw: string): CredentialConfig | null {
  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
      storage_bucket?: string;
    };

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return null;
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: toPrivateKey(parsed.private_key),
      storageBucket: parsed.storage_bucket
    };
  } catch {
    return null;
  }
}

function getCredentialConfig() {
  if (cachedCredentialConfig !== undefined) return cachedCredentialConfig;

  const fallbackProjectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const fallbackStorageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (fallbackProjectId ? `${fallbackProjectId}.firebasestorage.app` : undefined);

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8");
    const parsed = parseServiceAccountJson(decoded);
    if (parsed) {
      cachedCredentialConfig = {
        ...parsed,
        storageBucket: parsed.storageBucket ?? fallbackStorageBucket
      };
      return cachedCredentialConfig;
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (parsed) {
      cachedCredentialConfig = {
        ...parsed,
        storageBucket: parsed.storageBucket ?? fallbackStorageBucket
      };
      return cachedCredentialConfig;
    }
  }

  const projectId = fallbackProjectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    cachedCredentialConfig = null;
    return cachedCredentialConfig;
  }

  cachedCredentialConfig = {
    projectId,
    clientEmail,
    privateKey: toPrivateKey(privateKey),
    storageBucket: fallbackStorageBucket
  };
  return cachedCredentialConfig;
}

export function isFirebaseAdminConfigured() {
  return Boolean(getCredentialConfig());
}

export function getFirebaseAdminApp(): App | null {
  if (firebaseAdminApp !== undefined) return firebaseAdminApp;

  const cfg = getCredentialConfig();
  if (!cfg) {
    firebaseAdminApp = null;
    return null;
  }

  const existing = getApps()[0];
  firebaseAdminApp =
    existing ??
    initializeApp({
      credential: cert({
        projectId: cfg.projectId,
        clientEmail: cfg.clientEmail,
        privateKey: cfg.privateKey
      }),
      projectId: cfg.projectId,
      ...(cfg.storageBucket ? { storageBucket: cfg.storageBucket } : {})
    });

  return firebaseAdminApp;
}

export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getAuth(app);
}

export function getFirebaseAdminDb() {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getFirestore(app);
}

export function getFirebaseAdminStorageBucket() {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  const cfg = getCredentialConfig();
  if (cfg?.storageBucket) return getStorage(app).bucket(cfg.storageBucket);
  return getStorage(app).bucket();
}