import { NextResponse } from "next/server";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";

type ContactPayload = {
  name?: string;
  email?: string;
  topic?: string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ContactPayload;
    const message = String(payload.message ?? "").trim();
    const name = String(payload.name ?? "").trim();
    const email = String(payload.email ?? "").trim();
    const topic = String(payload.topic ?? "").trim();

    if (!message || !email) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const db = createFirebaseAdminClient();
    await db.from("contact_requests").insert({
      name: name || null,
      email,
      topic: topic || null,
      message,
      source: "homepage",
      status: "new"
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "contact_failed" }, { status: 500 });
  }
}
