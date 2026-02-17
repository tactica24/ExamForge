import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { getUserAiPreferences } from "@/lib/ai/user-preferences";
import { languageInstruction } from "@/lib/ai/language";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:ai:explain-wrong", req),
    windowMs: 10 * 60 * 1000,
    max: 40
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
  const exam = String(body?.exam ?? "").trim();
  const subject = String(body?.subject ?? "").trim();
  const question = String(body?.question ?? "").trim();
  const options: string[] = Array.isArray(body?.options) ? body.options.map(String) : [];
  const correct_index = Number(body?.correct_index ?? -1);
  const user_index = Number(body?.user_index ?? -1);

  if (!question || options.length !== 4 || correct_index < 0 || correct_index > 3 || user_index < 0 || user_index > 3) {
    return NextResponse.json({ ok: false, message: "Invalid payload." }, { status: 400 });
  }
  if (
    question.length > 2500 ||
    options.some((option) => option.length < 1 || option.length > 500) ||
    exam.length > 120 ||
    subject.length > 120
  ) {
    return NextResponse.json({ ok: false, message: "Payload is too large or malformed." }, { status: 400 });
  }

  const prefs = await getUserAiPreferences(user.id);
  const lang = languageInstruction(prefs.preferredLanguage);

  const client = getOpenAIClient();
  if (!client) {
    return NextResponse.json({
      ok: true,
      answer:
        "AI explain is not configured. Add OPENAI_API_KEY. For now: compare your chosen option with the correct one and identify the rule/definition that makes the correct option true."
    });
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: [
          "You are an exam prep coach.",
          "Explain why the user's selected option is incorrect and why the correct option is correct.",
          "Use 3 short bullets and then a 1-sentence memory tip.",
          "Do not invent official marking schemes.",
          lang
        ]
          .filter(Boolean)
          .join("\n")
      },
      {
        role: "user",
        content: `Exam: ${exam || "Unknown"}\nSubject: ${subject || "Unknown"}\nQuestion: ${question}\nOptions: ${options
          .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
          .join("\n")}\nUser picked: ${String.fromCharCode(65 + user_index)}\nCorrect: ${String.fromCharCode(65 + correct_index)}`
      }
    ]
  });

  const answer = completion.choices[0]?.message?.content ?? "Could not generate.";
  return NextResponse.json({ ok: true, answer });
}
