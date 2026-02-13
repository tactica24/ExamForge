import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/openai";

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = String(body?.message ?? "").trim();
  const subject = String(body?.subject ?? "").trim();
  const exam = String(body?.exam ?? "").trim();

  if (!message) return NextResponse.json({ ok: false, message: "Message required." }, { status: 400 });

  const client = getOpenAIClient();
  if (!client) {
    return NextResponse.json({
      ok: true,
      answer:
        "AI tutor is not configured. Add OPENAI_API_KEY to enable. For now: break the topic into definitions, formulas, examples, then practice 5 questions."
    });
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "You are ExamForge Tutor. Explain clearly, step-by-step, and include 1 short practice question with solution. Be safe and avoid hallucinating official exam rules. If unsure, say so."
      },
      {
        role: "user",
        content: `Exam: ${exam || "Unknown"}\nSubject: ${subject || "Unknown"}\nUser: ${message}`
      }
    ]
  });

  const answer = completion.choices[0]?.message?.content ?? "Sorry—could not generate a reply.";
  return NextResponse.json({ ok: true, answer });
}

