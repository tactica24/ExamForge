import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { languageInstruction } from "@/lib/ai/language";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = takeRateLimit({
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

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const language = String(body?.language ?? "en").toLowerCase();
  if (!text) return NextResponse.json({ ok: false, message: "Text required." }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ ok: false, message: "Text is too long." }, { status: 400 });
  if (!/^[a-z-]{2,20}$/i.test(language)) {
    return NextResponse.json({ ok: false, message: "Invalid language value." }, { status: 400 });
  }

  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ ok: true, text });

  const instruction = languageInstruction(language);
  if (!instruction) return NextResponse.json({ ok: true, text });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "You translate educational explanations faithfully. Keep math/technical terms accurate. Keep formatting readable."
      },
      { role: "user", content: `${instruction}\n\nTranslate/adapt this text:\n${text}` }
    ]
  });

  const out = completion.choices[0]?.message?.content ?? text;
  return NextResponse.json({ ok: true, text: out });
}
