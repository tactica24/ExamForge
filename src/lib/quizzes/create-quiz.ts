import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";
import { generateQuestions } from "@/lib/quizzes/questions";
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
  return Array.from(new Set(out)).slice(0, 30);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
  return `{${entries.join(",")}}`;
}

function buildCacheKey(args: {
  examId: string;
  subject: string;
  topicPath: string;
  quizType: "daily" | "extra" | "group" | "mock";
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  preferredLanguage?: string | null;
  meta?: Record<string, any>;
}) {
  return [
    args.examId,
    args.subject.trim().toLowerCase(),
    args.topicPath.trim().toLowerCase(),
    args.quizType,
    args.difficulty,
    String(args.questionCount),
    String(args.preferredLanguage ?? "en").toLowerCase(),
    stableStringify(args.meta ?? {})
  ].join("|");
}

async function cloneQuizFromCache(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  cacheKey: string;
  userId: string;
  examId: string;
  subject: string;
  topicPath: string;
  quizType: "daily" | "extra" | "group" | "mock";
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  preferredLanguage?: string | null;
  meta?: Record<string, any>;
}) {
  const { data: reusable } = await args.firebase
    .from("quizzes")
    .select("id")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .eq("topic_path", args.topicPath)
    .eq("quiz_type", args.quizType)
    .eq("difficulty", args.difficulty)
    .eq("meta.cache_key", args.cacheKey as any)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reusable?.id) return null;

  const { data: cachedQuestions } = await args.firebase
    .from("quiz_questions")
    .select("question,options,correct_index,explanation")
    .eq("quiz_id", reusable.id)
    .order("id", { ascending: true });

  if (!cachedQuestions?.length || cachedQuestions.length < args.questionCount) return null;

  const { data: quiz, error: quizErr } = await args.firebase
    .from("quizzes")
    .insert({
      exam_id: args.examId,
      subject: args.subject,
      topic_path: args.topicPath,
      quiz_type: args.quizType,
      difficulty: args.difficulty,
      created_by: args.userId,
      meta: {
        ...(args.meta ?? {}),
        preferred_language: args.preferredLanguage ?? "en",
        cache_key: args.cacheKey,
        reused_from_quiz_id: reusable.id
      }
    })
    .select("id")
    .single();
  if (quizErr) throw quizErr;

  const { error: insertErr } = await args.firebase.from("quiz_questions").insert(
    cachedQuestions.slice(0, args.questionCount).map((question) => ({
      quiz_id: quiz.id,
      question: question.question,
      options: question.options,
      correct_index: question.correct_index,
      explanation: question.explanation
    }))
  );
  if (insertErr) throw insertErr;

  return quiz.id;
}

export async function createQuizWithQuestions(args: {
  userId: string;
  examId: string;
  examName: string;
  examSlug?: string;
  subject: string;
  topicPath: string;
  quizType: "daily" | "extra" | "group" | "mock";
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  preferredLanguage?: string | null;
  meta?: Record<string, any>;
}) {
  const firebase = await createFirebaseServerClient();
  const cacheKey = buildCacheKey(args);

  const clonedQuizId = await cloneQuizFromCache({
    firebase,
    cacheKey,
    userId: args.userId,
    examId: args.examId,
    subject: args.subject,
    topicPath: args.topicPath,
    quizType: args.quizType,
    difficulty: args.difficulty,
    questionCount: args.questionCount,
    preferredLanguage: args.preferredLanguage,
    meta: args.meta
  });
  if (clonedQuizId) return clonedQuizId;

  const { data: quiz, error: quizErr } = await firebase
    .from("quizzes")
    .insert({
      exam_id: args.examId,
      subject: args.subject,
      topic_path: args.topicPath,
      quiz_type: args.quizType,
      difficulty: args.difficulty,
      created_by: args.userId,
      meta: {
        ...(args.meta ?? {}),
        preferred_language: args.preferredLanguage ?? "en",
        cache_key: cacheKey
      }
    })
    .select("id")
    .single();
  if (quizErr) throw quizErr;

  let examSlug = args.examSlug;
  if (!examSlug) {
    const { data: exam } = await firebase.from("exams").select("slug").eq("id", args.examId).maybeSingle();
    examSlug = exam?.slug ?? undefined;
  }

  let syllabus: string[] | undefined;
  if (examSlug) {
    const topics = await getTopicsForExamSubject({ examId: args.examId, examSlug, subject: args.subject });
    if (topics.length) syllabus = flattenTopics(topics);
  }

  const questions = await generateQuestions({
    examName: args.examName,
    subject: args.subject,
    topic: args.topicPath,
    count: args.questionCount,
    preferredLanguage: args.preferredLanguage ?? null,
    syllabus
  });

  const { error: qErr } = await firebase.from("quiz_questions").insert(
    questions.map((q) => ({
      quiz_id: quiz.id,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation
    }))
  );
  if (qErr) throw qErr;

  return quiz.id;
}
