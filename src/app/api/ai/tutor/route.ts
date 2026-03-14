import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { getUserAiPreferences } from "@/lib/ai/user-preferences";
import { languageInstruction } from "@/lib/ai/language";
import { generateTextWithFallback } from "@/lib/ai/multi";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";

function flattenTopics(topics: Array<{ title: string; path: string; subtopics?: string[] }>) {
  const out: string[] = [];
  for (const topic of topics) {
    if (topic.title) out.push(String(topic.title));
    if (topic.path && topic.path !== topic.title) out.push(String(topic.path));
    if (Array.isArray(topic.subtopics)) {
      for (const sub of topic.subtopics) out.push(`${topic.title}: ${sub}`);
    }
  }
  return Array.from(new Set(out)).slice(0, 35);
}

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:ai:tutor", req),
    windowMs: 10 * 60 * 1000,
    max: 40
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
  const message = String(body?.message ?? "").trim();
  const subject = String(body?.subject ?? "").trim();
  const exam = String(body?.exam ?? "").trim();
  const examId = String(body?.exam_id ?? "").trim();
  const threadIdRaw = String(body?.thread_id ?? "").trim();

  if (!message) return NextResponse.json({ ok: false, message: "Message required." }, { status: 400 });
  if (message.length > 2000) {
    return NextResponse.json({ ok: false, message: "Message is too long." }, { status: 400 });
  }
  if (subject.length > 120 || exam.length > 120 || examId.length > 120) {
    return NextResponse.json({ ok: false, message: "Invalid exam or subject value." }, { status: 400 });
  }

  const prefs = await getUserAiPreferences(user.id);
  const lang = languageInstruction(prefs.preferredLanguage);

  let syllabusNote = "If a syllabus is available, keep answers aligned to it. Otherwise, respond generally for the exam level.";
  if (examId && subject) {
    const { data: examRow } = await backend.from("exams").select("slug").eq("id", examId).maybeSingle();
    const examSlug = examRow?.slug ?? "";
    if (examSlug) {
      const topics = await getTopicsForExamSubject({ examId, examSlug, subject });
      const syllabus = topics.length ? flattenTopics(topics) : [];
      if (syllabus.length) {
        syllabusNote = `Use only these syllabus topics/subtopics when possible:\n- ${syllabus.join("\n- ")}`;
      }
    }
  }

  let threadId = threadIdRaw;
  if (threadId) {
    const { data: existingThread } = await backend
      .from("tutor_threads")
      .select("id,user_id")
      .eq("id", threadId)
      .maybeSingle();
    if (!existingThread || existingThread.user_id !== user.id) {
      threadId = "";
    }
  }

  if (!threadId) {
    threadId = randomUUID();
    await backend.from("tutor_threads").insert({
      id: threadId,
      user_id: user.id,
      exam_id: examId || null,
      exam: exam || null,
      subject: subject || null,
      title: message.slice(0, 80),
      created_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    });
  }

  await backend.from("tutor_messages").insert({
    id: randomUUID(),
    thread_id: threadId,
    user_id: user.id,
    role: "user",
    content: message,
    created_at: new Date().toISOString()
  });

  const ai = await generateTextWithFallback({
    system: [
      "You are ACE NAIJA Tutor.",
      "Explain clearly, step-by-step, and include 1 short practice question with solution.",
      "Optimize for deep understanding and exam pass confidence: define concepts, then apply them.",
      "Be safe and avoid hallucinating official exam rules. If unsure, say so.",
      syllabusNote,
      lang
    ]
      .filter(Boolean)
      .join("\n"),
    user: `Exam: ${exam || "Unknown"}\nSubject: ${subject || "Unknown"}\nUser: ${message}`,
    temperature: 0.5
  });

  const answer =
    ai.text ||
    "Break the topic into definitions, formulas, and examples first, then solve 5 practice questions and review your mistakes.";

  await backend.from("tutor_messages").insert({
    id: randomUUID(),
    thread_id: threadId,
    user_id: user.id,
    role: "assistant",
    content: answer,
    created_at: new Date().toISOString()
  });

  await backend
    .from("tutor_threads")
    .update({
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    })
    .eq("id", threadId);

  return NextResponse.json({ ok: true, answer, thread_id: threadId });
}

