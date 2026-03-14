import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { isBackendStorageConfigured, uploadBackendStorageObject } from "@/lib/backend/storage";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function hasValidSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/png") {
    if (bytes.length < 8) return false;
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === "image/jpeg") {
    if (bytes.length < 3) return false;
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/webp") {
    if (bytes.length < 12) return false;
    const riff = bytes.toString("ascii", 0, 4);
    const webp = bytes.toString("ascii", 8, 12);
    return riff === "RIFF" && webp === "WEBP";
  }

  return false;
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:profile:avatar", request),
    windowMs: 15 * 60 * 1000,
    max: 20
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many upload attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "No file uploaded." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, message: "Unsupported image type. Use PNG, JPG, or WEBP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ ok: false, message: "Image is too large. Maximum size is 2MB." }, { status: 400 });
  }

  if (!isBackendStorageConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Avatar uploads require the configured backend storage service."
      },
      { status: 500 }
    );
  }

  const ext = extensionFromMimeType(file.type);
  const safeUserId = String(user.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const storagePath = `avatars/${safeUserId}/${Date.now()}-${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (!hasValidSignature(bytes, file.type)) {
    return NextResponse.json({ ok: false, message: "Invalid image file signature." }, { status: 400 });
  }

  const uploaded = await uploadBackendStorageObject({
    path: storagePath,
    bytes,
    contentType: file.type,
    cacheControl: "public, max-age=31536000, immutable"
  });
  const avatarUrl = uploaded.url;

  const { error } = await backend
    .from("profiles")
    .upsert({ user_id: user.id, avatar_url: avatarUrl }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatarUrl });
}
