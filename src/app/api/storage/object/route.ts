import { NextResponse } from "next/server";
import { readBackendStorageObject } from "@/lib/backend/storage";

export const runtime = "nodejs";

function cleanKey(value: string | null) {
  const key = String(value ?? "").trim();
  return key || null;
}

function safeFileName(value: string) {
  return String(value || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = cleanKey(url.searchParams.get("key"));
  const shouldDownload = url.searchParams.get("download") === "1";

  if (!key) {
    return NextResponse.json({ ok: false, message: "Missing object key." }, { status: 400 });
  }

  let object;
  try {
    object = await readBackendStorageObject(key);
  } catch {
    return NextResponse.json({ ok: false, message: "Could not read the stored file right now." }, { status: 500 });
  }
  if (!object) {
    return NextResponse.json({ ok: false, message: "File not found." }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", object.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", object.cacheControl ?? "private, max-age=300");
  if (object.contentLength) headers.set("Content-Length", String(object.contentLength));
  if (object.etag) headers.set("ETag", object.etag);
  headers.set(
    "Content-Disposition",
    shouldDownload ? `attachment; filename="${safeFileName(key.split("/").pop() ?? "file")}"` : "inline"
  );

  const body = object.body as BodyInit;
  return new NextResponse(body, { headers });
}
