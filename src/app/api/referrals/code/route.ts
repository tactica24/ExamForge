import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function GET() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const { data: existing } = await backend.from("referral_codes").select("code").eq("user_id", user.id).maybeSingle();
  if (existing?.code) return NextResponse.json({ ok: true, code: existing.code });

  // Try a few times in case of rare collisions.
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    const { data: conflict } = await backend.from("referral_codes").select("code").eq("code", code).maybeSingle();
    if (conflict?.code) continue;

    const { error } = await backend.from("referral_codes").insert({ user_id: user.id, code });
    if (!error) return NextResponse.json({ ok: true, code });
  }

  return NextResponse.json({ ok: false, message: "Could not allocate referral code." }, { status: 500 });
}

