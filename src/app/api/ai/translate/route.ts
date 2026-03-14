import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { languageInstruction } from "@/lib/ai/language";
import { generateTextWithFallback } from "@/lib/ai/multi";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:ai:translate", req),
    windowMs: 10 * 60 * 1000,
    max: 80
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many AI requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const language = String(body?.language ?? "en").toLowerCase();
  if (!text) return NextResponse.json({ ok: false, message: "Text required." }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ ok: false, message: "Text is too long." }, { status: 400 });
  if (!/^[a-z-]{2,20}$/i.test(language)) {
    return NextResponse.json({ ok: false, message: "Invalid language value." }, { status: 400 });
  }

  const instruction = languageInstruction(language);
  if (!instruction) return NextResponse.json({ ok: true, text });

  const ai = await generateTextWithFallback({
    system: "You translate educational explanations faithfully. Keep math/technical terms accurate. Keep formatting readable.",
    user: `${instruction}\n\nTranslate/adapt this text:\n${text}`,
    temperature: 0.4
  });

  const out = ai.text ?? text;
  return NextResponse.json({ ok: true, text: out });
}

