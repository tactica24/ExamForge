import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { getUserAiPreferences } from "@/lib/ai/user-preferences";
import { languageInstruction } from "@/lib/ai/language";
import { generateJsonWithFallback } from "@/lib/ai/multi";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";

type WrongQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  user_index: number;
};

function flattenTopics(topics: Array<{ title: string; path: string; subtopics?: string[] }>) {
  const out: string[] = [];
  for (const topic of topics) {
    if (topic.title) out.push(String(topic.title));
    if (topic.path && topic.path !== topic.title) out.push(String(topic.path));
    if (Array.isArray(topic.subtopics)) {
      for (const sub of topic.subtopics) out.push(`${topic.title}: ${sub}`);
    }
  }
  return Array.from(new Set(out)).slice(0, 30);
}

function parseQuestions(raw: unknown): WrongQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      id: String(item?.id ?? "").trim(),
      question: String(item?.question ?? "").trim(),
      options: Array.isArray(item?.options) ? item.options.map(String) : [],
      correct_index: Number(item?.correct_index ?? -1),
      user_index: Number(item?.user_index ?? -1)
    }))
    .filter(
      (item) =>
        item.id &&
        item.question &&
        item.options.length === 4 &&
        item.correct_index >= 0 &&
        item.correct_index <= 3 &&
        item.user_index >= 0 &&
        item.user_index <= 3 &&
        item.correct_index !== item.user_index
    )
    .slice(0, 30);
}

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:ai:explain-review", req),
    windowMs: 10 * 60 * 1000,
    max: 20
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
  const exam = String(body?.exam ?? "").trim();
  const examId = String(body?.exam_id ?? "").trim();
  const subject = String(body?.subject ?? "").trim();
  const questions = parseQuestions(body?.questions);

  if (!questions.length) {
    return NextResponse.json({ ok: false, message: "No invalid answers supplied." }, { status: 400 });
  }

  const prefs = await getUserAiPreferences(user.id);
  const lang = languageInstruction(prefs.preferredLanguage);

  let syllabusNote = "If a syllabus is available, keep explanations aligned to it.";
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

  const allowedIds = new Set(questions.map((q) => q.id));

  const ai = await generateJsonWithFallback<{ answers: Array<{ id: string; text: string }> }>({
    system: [
      "You are an exam prep coach.",
      "For each missed objective question, explain why the selected option is wrong and why the correct option is right.",
      "Keep each explanation concise: 3 short bullets plus 1 memory tip.",
      'Return valid JSON only in this shape: {"answers":[{"id":"question-id","text":"..."}]}.',
      syllabusNote,
      lang
    ]
      .filter(Boolean)
      .join("\n"),
    user: JSON.stringify({
      exam: exam || "Unknown",
      subject: subject || "Unknown",
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options.map((option, idx) => `${String.fromCharCode(65 + idx)}. ${option}`),
        user_pick: String.fromCharCode(65 + q.user_index),
        correct: String.fromCharCode(65 + q.correct_index)
      }))
    }),
    temperature: 0.35,
    validate: (parsed) => {
      const items: unknown[] = Array.isArray(parsed?.answers) ? (parsed.answers as unknown[]) : [];
      const answers: Array<{ id: string; text: string }> = items
        .map((item: unknown): { id: string; text: string } => {
          const row = item as { id?: unknown; text?: unknown };
          return {
            id: String(row.id ?? "").trim(),
            text: String(row.text ?? "").trim()
          };
        })
        .filter((item: { id: string; text: string }) => item.id.length > 0 && item.text.length > 0 && allowedIds.has(item.id));
      return answers.length ? { answers } : null;
    }
  });

  if (!ai.value?.answers?.length) {
    return NextResponse.json({ ok: true, answers: {} });
  }

  const answers: Record<string, string> = {};
  for (const item of ai.value.answers) {
    answers[item.id] = item.text.slice(0, 1200);
  }

  return NextResponse.json({ ok: true, answers });
}


