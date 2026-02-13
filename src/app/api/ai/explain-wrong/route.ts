import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { getUserAiPreferences } from "@/lib/ai/user-preferences";
import { languageInstruction } from "@/lib/ai/language";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
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
