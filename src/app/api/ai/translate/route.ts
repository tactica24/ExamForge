import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { languageInstruction } from "@/lib/ai/language";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const language = String(body?.language ?? "en").toLowerCase();
  if (!text) return NextResponse.json({ ok: false, message: "Text required." }, { status: 400 });

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
