import "server-only";

import { createHash, createHmac } from "node:crypto";
import { getAwsRuntimeCredentials } from "@/lib/aws/runtime-credentials";

function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!*'()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalUri(pathname: string) {
  const raw = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return raw
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

function canonicalQuery(url: URL) {
  const pairs = Array.from(url.searchParams.entries()).map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const);
  pairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return pairs.map(([key, value]) => `${key}=${value}`).join("&");
}

function amzDate(now = new Date()) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function shortDate(fullAmzDate: string) {
  return fullAmzDate.slice(0, 8);
}

export async function signedAwsFetch(args: {
  method: string;
  region: string;
  service: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
}) {
  const url = new URL(args.url);
  const requestDate = amzDate();
  const scopeDate = shortDate(requestDate);
  const credentials = getAwsRuntimeCredentials();
  const bodyBytes =
    typeof args.body === "string" ? Buffer.from(args.body, "utf8") : Buffer.from(args.body ?? new Uint8Array());
  const payloadHash = sha256Hex(bodyBytes);

  const headerEntries = new Map<string, string>();
  headerEntries.set("host", url.host);
  headerEntries.set("x-amz-content-sha256", payloadHash);
  headerEntries.set("x-amz-date", requestDate);

  for (const [key, value] of Object.entries(args.headers ?? {})) {
    headerEntries.set(key.toLowerCase(), String(value).trim());
  }

  if (credentials.sessionToken) {
    headerEntries.set("x-amz-security-token", credentials.sessionToken);
  }

  const sortedHeaders = Array.from(headerEntries.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = sortedHeaders.map(([key, value]) => `${key}:${value.replace(/\s+/g, " ").trim()}\n`).join("");
  const signedHeaders = sortedHeaders.map(([key]) => key).join(";");
  const credentialScope = `${scopeDate}/${args.region}/${args.service}/aws4_request`;
  const canonicalRequest = [
    args.method.toUpperCase(),
    canonicalUri(url.pathname),
    canonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    requestDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");

  const kDate = hmac(`AWS4${credentials.secretAccessKey}`, scopeDate);
  const kRegion = hmac(kDate, args.region);
  const kService = hmac(kRegion, args.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(", ");

  const headers = new Headers();
  for (const [key, value] of sortedHeaders) {
    headers.set(key, value);
  }
  headers.set("authorization", authorization);

  return fetch(url, {
    method: args.method.toUpperCase(),
    headers,
    body: bodyBytes.length ? bodyBytes : undefined,
    cache: "no-store"
  });
}
