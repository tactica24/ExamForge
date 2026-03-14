import "server-only";

import { Buffer } from "node:buffer";
import { getAwsBackendConfig } from "@/lib/aws/config";
import { hasAwsRuntimeCredentials } from "@/lib/aws/runtime-credentials";
import { signedAwsFetch } from "@/lib/aws/signature-v4";

type UploadArgs = {
  bytes: Buffer;
  cacheControl: string;
  contentType: string;
  path: string;
};

export type BackendStorageObject = {
  body: ReadableStream<Uint8Array> | Uint8Array;
  cacheControl: string | null;
  contentLength: number | null;
  contentType: string | null;
  etag: string | null;
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function encodeKeyPath(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function normalizeStorageKey(value: string) {
  const key = String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!key || key.includes("..")) return null;
  return key;
}

export function isAwsS3Configured() {
  const cfg = getAwsBackendConfig();
  return Boolean(cfg.s3BucketName && cfg.s3Region && hasAwsRuntimeCredentials());
}

function getObjectUrl(bucketName: string, region: string, key: string) {
  return `https://${bucketName}.s3.${region}.amazonaws.com/${encodeKeyPath(key)}`;
}

export async function uploadAwsS3Object(args: UploadArgs) {
  const cfg = getAwsBackendConfig();
  if (!cfg.s3BucketName || !cfg.s3Region) {
    throw new Error("AWS S3 storage is not configured.");
  }

  const key = normalizeStorageKey(args.path);
  if (!key) {
    throw new Error("Invalid backend storage key.");
  }

  const res = await signedAwsFetch({
    method: "PUT",
    region: cfg.s3Region,
    service: "s3",
    url: getObjectUrl(cfg.s3BucketName, cfg.s3Region, key),
    headers: {
      "cache-control": args.cacheControl,
      "content-type": args.contentType
    },
    body: args.bytes
  });

  if (!res.ok) {
    const message = cleanText(await res.text().catch(() => "")) ?? "S3 upload failed.";
    throw new Error(message);
  }

  return {
    key,
    provider: "s3" as const
  };
}

export async function readAwsS3Object(key: string): Promise<BackendStorageObject | null> {
  const cfg = getAwsBackendConfig();
  if (!cfg.s3BucketName || !cfg.s3Region) {
    return null;
  }

  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) return null;

  const res = await signedAwsFetch({
    method: "GET",
    region: cfg.s3Region,
    service: "s3",
    url: getObjectUrl(cfg.s3BucketName, cfg.s3Region, normalizedKey)
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const message = cleanText(await res.text().catch(() => "")) ?? "S3 object download failed.";
    throw new Error(message);
  }

  return {
    body: res.body ?? new Uint8Array(await res.arrayBuffer()),
    cacheControl: cleanText(res.headers.get("cache-control")),
    contentLength: Number.parseInt(String(res.headers.get("content-length") ?? ""), 10) || null,
    contentType: cleanText(res.headers.get("content-type")),
    etag: cleanText(res.headers.get("etag"))
  };
}
