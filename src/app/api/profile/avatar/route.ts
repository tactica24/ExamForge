import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin-app";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();

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

  const bucket = getFirebaseAdminStorageBucket();
  if (!bucket) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Avatar uploads require Firebase admin storage configuration (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET)."
      },
      { status: 500 }
    );
  }

  const ext = extensionFromMimeType(file.type);
  const storagePath = `avatars/${user.id}/${Date.now()}-${randomUUID()}.${ext}`;
  const token = randomUUID();
  const bytes = Buffer.from(await file.arrayBuffer());

  await bucket.file(storagePath).save(bytes, {
    resumable: false,
    metadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    }
  });

  const encodedPath = encodeURIComponent(storagePath);
  const avatarUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

  const { error } = await firebase
    .from("profiles")
    .upsert({ user_id: user.id, avatar_url: avatarUrl }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatarUrl });
}
