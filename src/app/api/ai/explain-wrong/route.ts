import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/backend/server";
import { getUserAiPreferences } from "@/lib/ai/user-preferences";
import { languageInstruction } from "@/lib/ai/language";
import { generateTextWithFallback } from "@/lib/ai/multi";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";
import { getQuizReviewFeedback, withQuizReviewFeedback } from "@/lib/quizzes/review-feedback";

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

export async function POST(req: Request) {
  if (!hasTrustedOrigin(req.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
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

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const exam = String(body?.exam ?? "").trim();
  const examId = String(body?.exam_id ?? "").trim();
  const quizId = String(body?.quiz_id ?? "").trim();
  const questionId = String(body?.question_id ?? "").trim();
  const refresh = Boolean(body?.refresh);
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
    subject.length > 120 ||
    examId.length > 120
  ) {
    return NextResponse.json({ ok: false, message: "Payload is too large or malformed." }, { status: 400 });
  }

  let quizMeta: unknown = null;
  if (quizId && questionId && !refresh) {
    const { data: quiz } = await backend
      .from("quizzes")
      .select("id,meta")
      .eq("id", quizId)
      .eq("created_by", user.id)
      .maybeSingle();
    if (quiz?.id) {
      const feedback = getQuizReviewFeedback(quiz.meta);
      if (feedback[questionId]) {
        return NextResponse.json({ ok: true, answer: feedback[questionId] });
      }
      quizMeta = quiz.meta;
    }
  } else if (quizId && questionId) {
    const { data: quiz } = await backend
      .from("quizzes")
      .select("id,meta")
      .eq("id", quizId)
      .eq("created_by", user.id)
      .maybeSingle();
    if (quiz?.id) {
      quizMeta = quiz.meta;
    }
  }

  const prefs = await getUserAiPreferences(user.id);
  const lang = languageInstruction(prefs.preferredLanguage);

  let syllabusNote = "If a syllabus is available, keep the explanation aligned to it. Otherwise, respond generally.";
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

  const ai = await generateTextWithFallback({
    system: [
      "You are a careful subject tutor.",
      "Explain why the user's selected option is incorrect and why the correct option is correct.",
      "Use 3 short bullets and then a 1-sentence quick reminder.",
      "Prioritize conceptual clarity and exam application.",
      "Write naturally, not like an AI coach or motivational assistant.",
      "Do not invent official marking schemes.",
      syllabusNote,
      lang
    ]
      .filter(Boolean)
      .join("\n"),
    user: `Exam: ${exam || "Unknown"}\nSubject: ${subject || "Unknown"}\nQuestion: ${question}\nOptions: ${options
      .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
      .join("\n")}\nUser picked: ${String.fromCharCode(65 + user_index)}\nCorrect: ${String.fromCharCode(65 + correct_index)}`,
    temperature: 0.4
  });

  if (!ai.text) {
    return NextResponse.json({
      ok: true,
      answer:
        "Compare your chosen option with the correct one, then identify the key rule or definition that makes the correct option true."
    });
  }

  const answer = ai.text.slice(0, 1200);

  if (quizId && questionId) {
    const nextFeedback = {
      ...getQuizReviewFeedback(quizMeta),
      [questionId]: answer
    };
    await backend
      .from("quizzes")
      .update({ meta: withQuizReviewFeedback(quizMeta, nextFeedback) })
      .eq("id", quizId)
      .eq("created_by", user.id);
  }

  return NextResponse.json({ ok: true, answer });
}

