import "server-only";

import { Buffer } from "node:buffer";
import {
  isAwsS3Configured,
  normalizeStorageKey,
  readAwsS3Object,
  uploadAwsS3Object,
  type BackendStorageObject
} from "@/lib/aws/s3";

type UploadArgs = {
  bytes: Buffer;
  cacheControl: string;
  contentType: string;
  path: string;
};

function buildStorageProxyUrl(key: string) {
  return `/api/storage/object?key=${encodeURIComponent(key)}`;
}

export function isAllowedAssetUrl(value: string | null | undefined) {
  const url = String(value ?? "").trim();
  if (!url) return false;
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

export function isBackendStorageConfigured() {
  return isAwsS3Configured();
}

export async function uploadBackendStorageObject(args: UploadArgs) {
  const storageKey = normalizeStorageKey(args.path);
  if (!storageKey) {
    throw new Error("Invalid backend storage key.");
  }

  if (isAwsS3Configured()) {
    const uploaded = await uploadAwsS3Object({
      ...args,
      path: storageKey
    });

    return {
      provider: "backend-object-storage" as const,
      key: uploaded.key,
      url: buildStorageProxyUrl(uploaded.key)
    };
  }

  throw new Error("AWS S3 storage is not configured.");
}

export async function readBackendStorageObject(key: string): Promise<BackendStorageObject | null> {
  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) return null;

  if (isAwsS3Configured()) {
    return readAwsS3Object(normalizedKey);
  }

  return null;
}
