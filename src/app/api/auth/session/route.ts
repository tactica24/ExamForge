import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setFirebaseSessionCookie } from "@/lib/firebase/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const idToken = String(body?.idToken ?? "").trim();

  if (!idToken) {
    return NextResponse.json({ ok: false, message: "idToken is required." }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    await setFirebaseSessionCookie(cookieStore, idToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create session.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}