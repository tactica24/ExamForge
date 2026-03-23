import "server-only";

import { createHash } from "crypto";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { pickQuestionBankQuestions } from "@/lib/question-bank/select";
import {
  fallbackQuestions,
  generateQuestions,
  isPlaceholderQuestion,
  type GeneratedQuestion
} from "@/lib/quizzes/questions";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";

type QuizType = "daily" | "extra" | "group" | "mock";
type Difficulty = "easy" | "medium" | "hard";
const QUIZ_CONTENT_VERSION = "quiz-style-v2";

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

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeMetaForPool(meta: Record<string, any> | undefined) {
  if (!meta || typeof meta !== "object") return {};

  const completedTopics = Array.isArray(meta.completed_topics)
    ? meta.completed_topics
        .map((entry) => normalizeText(entry, 160).toLowerCase())
        .filter(Boolean)
        .filter((entry: string, index: number, all: string[]) => all.indexOf(entry) === index)
        .sort()
    : [];

  if (completedTopics.length) {
    return { completed_topics: completedTopics };
  }

  return {};
}

function buildPoolKey(args: {
  examId: string;
  subject: string;
  topicPath: string;
  quizType: QuizType;
  difficulty: Difficulty;
  preferredLanguage?: string | null;
  meta?: Record<string, any>;
}) {
  return [
    args.examId,
    args.subject.trim().toLowerCase(),
    args.topicPath.trim().toLowerCase(),
    args.quizType,
    args.difficulty,
    String(args.preferredLanguage ?? "en").toLowerCase(),
    stableStringify(normalizeMetaForPool(args.meta)),
    QUIZ_CONTENT_VERSION
  ].join("|");
}

function buildCacheKey(args: {
  poolKey: string;
  questionCount: number;
}) {
  return `${args.poolKey}|q:${Math.max(1, Math.trunc(args.questionCount || 1))}`;
}

function questionKey(question: GeneratedQuestion) {
  const stem = normalizeText(question.question, 500).toLowerCase();
  const opts = question.options.map((option) => normalizeText(option, 160).toLowerCase()).join("|");
  return `${stem}|${opts}`;
}

function normalizeQuestionRow(row: any): GeneratedQuestion | null {
  const question = normalizeText(row?.question, 500);
  const options = Array.isArray(row?.options)
    ? row.options.map((option: unknown) => normalizeText(option, 160)).filter(Boolean).slice(0, 4)
    : [];
  const correctIndex = Math.max(0, Math.min(3, Number(row?.correct_index ?? 0)));
  const explanation = normalizeText(row?.explanation, 800);

  if (!question || options.length !== 4 || !Number.isFinite(correctIndex)) return null;

  const normalized: GeneratedQuestion = {
    question,
    options,
    correct_index: correctIndex,
    explanation
  };

  if (isPlaceholderQuestion(normalized)) return null;
  return normalized;
}

function dedupeQuestions(questions: GeneratedQuestion[]) {
  const seen = new Set<string>();
  const out: GeneratedQuestion[] = [];

  for (const question of questions) {
    const key = questionKey(question);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(question);
  }

  return out;
}

function seededShuffle<T>(items: T[], seed: string) {
  const arr = [...items];
  if (arr.length <= 1) return arr;

  const initial = createHash("sha256").update(seed).digest().readUInt32BE(0);
  let state = initial || 1;

  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    const temp = arr[i];
    arr[i] = arr[j] as T;
    arr[j] = temp as T;
  }

  return arr;
}

async function fetchQuestionsForQuizIds(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  quizIds: string[];
}) {
  const rows: any[] = [];
  for (const batch of chunk(args.quizIds, 60)) {
    const { data } = await args.firebase
      .from("quiz_questions")
      .select("quiz_id,question,options,correct_index,explanation")
      .in("quiz_id", batch);
    if (data?.length) rows.push(...data);
  }
  return rows;
}

async function pickReusableQuestions(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  examId: string;
  subject: string;
  topicPath: string;
  quizType: QuizType;
  difficulty: Difficulty;
  questionCount: number;
  poolKey: string;
}): Promise<GeneratedQuestion[]> {
  const countNeeded = Math.max(1, Math.trunc(args.questionCount || 1));
  const baseFilters = args.firebase
    .from("quizzes")
    .select("id,created_by")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .eq("topic_path", args.topicPath)
    .eq("quiz_type", args.quizType)
    .eq("difficulty", args.difficulty);

  const { data: withPoolKey } = await baseFilters
    .eq("meta.pool_key", args.poolKey as any)
    .order("created_at", { ascending: false })
    .limit(160);

  const { data: fallbackSource } = withPoolKey?.length
    ? { data: null as any[] | null }
    : await args.firebase
        .from("quizzes")
        .select("id,created_by")
        .eq("exam_id", args.examId)
        .eq("subject", args.subject)
        .eq("topic_path", args.topicPath)
        .eq("quiz_type", args.quizType)
        .eq("difficulty", args.difficulty)
        .order("created_at", { ascending: false })
        .limit(160);

  const sourceQuizzes = withPoolKey?.length ? withPoolKey : fallbackSource ?? [];
  const sourceQuizIds = sourceQuizzes.map((row: any) => String(row?.id ?? "")).filter(Boolean);
  if (!sourceQuizIds.length) return [];

  const sourceQuestionRows = await fetchQuestionsForQuizIds({
    firebase: args.firebase,
    quizIds: sourceQuizIds
  });
  const sourceQuestions = dedupeQuestions(
    sourceQuestionRows.map((row) => normalizeQuestionRow(row)).filter(Boolean) as GeneratedQuestion[]
  );
  if (sourceQuestions.length < countNeeded) return [];

  const { data: userQuizzes } = await args.firebase
    .from("quizzes")
    .select("id")
    .eq("created_by", args.userId)
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .eq("topic_path", args.topicPath)
    .eq("quiz_type", args.quizType)
    .order("created_at", { ascending: false })
    .limit(60);

  const seenKeys = new Set<string>();
  const userQuizIds = (userQuizzes ?? []).map((row: any) => String(row?.id ?? "")).filter(Boolean);
  if (userQuizIds.length) {
    const seenRows = await fetchQuestionsForQuizIds({
      firebase: args.firebase,
      quizIds: userQuizIds
    });
    for (const row of seenRows) {
      const normalized = normalizeQuestionRow(row);
      if (!normalized) continue;
      seenKeys.add(questionKey(normalized));
    }
  }

  const unseen = sourceQuestions.filter((question) => !seenKeys.has(questionKey(question)));
  const previouslySeen = sourceQuestions.filter((question) => seenKeys.has(questionKey(question)));
  const seed = `${args.userId}|${args.poolKey}|${Date.now()}`;

  const ordered = [...seededShuffle(unseen, `${seed}:unseen`), ...seededShuffle(previouslySeen, `${seed}:seen`)];
  return ordered.slice(0, countNeeded);
}

async function createQuizRecord(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  examId: string;
  subject: string;
  topicPath: string;
  quizType: QuizType;
  difficulty: Difficulty;
  preferredLanguage?: string | null;
  poolKey: string;
  cacheKey: string;
  meta?: Record<string, any>;
}) {
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
        pool_key: args.poolKey,
        cache_key: args.cacheKey
      }
    })
    .select("id")
    .single();

  if (quizErr) throw quizErr;
  return quiz.id as string;
}

async function insertQuizQuestions(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  quizId: string;
  questions: GeneratedQuestion[];
}) {
  const { error } = await args.firebase.from("quiz_questions").insert(
    args.questions.map((question) => ({
      quiz_id: args.quizId,
      question: question.question,
      options: question.options,
      correct_index: question.correct_index,
      explanation: question.explanation
    }))
  );

  if (error) throw error;
}

async function deleteQuizRecord(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  quizId: string;
}) {
  await args.firebase.from("quiz_questions").delete().eq("quiz_id", args.quizId);
  await args.firebase.from("quizzes").delete().eq("id", args.quizId);
}

export async function createQuizWithQuestions(args: {
  userId: string;
  examId: string;
  examName: string;
  examSlug?: string;
  subject: string;
  topicPath: string;
  quizType: QuizType;
  difficulty: Difficulty;
  questionCount: number;
  preferredLanguage?: string | null;
  meta?: Record<string, any>;
  syllabusOverride?: string[];
}) {
  const firebase = await createFirebaseServerClient();
  const poolKey = buildPoolKey(args);
  const cacheKey = buildCacheKey({
    poolKey,
    questionCount: args.questionCount
  });

  const reusableQuestions = await pickReusableQuestions({
    firebase,
    userId: args.userId,
    examId: args.examId,
    subject: args.subject,
    topicPath: args.topicPath,
    quizType: args.quizType,
    difficulty: args.difficulty,
    questionCount: args.questionCount,
    poolKey
  });

  const bankQuestions = await pickQuestionBankQuestions({
    firebase,
    userId: args.userId,
    examId: args.examId,
    subject: args.subject,
    topicPath: args.topicPath,
    difficulty: args.difficulty,
    questionCount: args.questionCount,
    syllabus: args.syllabusOverride
  });

  const prebuiltQuestions = dedupeQuestions([...reusableQuestions, ...bankQuestions]).slice(0, args.questionCount);

  if (prebuiltQuestions.length >= args.questionCount) {
    const quizId = await createQuizRecord({
      firebase,
      userId: args.userId,
      examId: args.examId,
      subject: args.subject,
      topicPath: args.topicPath,
      quizType: args.quizType,
      difficulty: args.difficulty,
      preferredLanguage: args.preferredLanguage,
      poolKey,
      cacheKey,
      meta: {
        ...(args.meta ?? {}),
        reused_question_pool: reusableQuestions.length > 0,
        question_bank_used: bankQuestions.length > 0
      }
    });
    try {
      await insertQuizQuestions({
        firebase,
        quizId,
        questions: prebuiltQuestions
      });
      return quizId;
    } catch (error) {
      await deleteQuizRecord({ firebase, quizId });
      throw error;
    }
  }

  const quizId = await createQuizRecord({
    firebase,
    userId: args.userId,
    examId: args.examId,
    subject: args.subject,
    topicPath: args.topicPath,
    quizType: args.quizType,
    difficulty: args.difficulty,
    preferredLanguage: args.preferredLanguage,
    poolKey,
    cacheKey,
    meta: {
      ...(args.meta ?? {}),
      reused_question_pool: reusableQuestions.length > 0,
      question_bank_used: bankQuestions.length > 0
    }
  });

  try {
    let examSlug = args.examSlug;
    if (!examSlug) {
      const { data: exam } = await firebase.from("exams").select("slug").eq("id", args.examId).maybeSingle();
      examSlug = exam?.slug ?? undefined;
    }

    let syllabus: string[] | undefined = args.syllabusOverride?.length ? args.syllabusOverride : undefined;
    if (!syllabus && examSlug) {
      try {
        const topics = await getTopicsForExamSubject({ examId: args.examId, examSlug, subject: args.subject });
        if (topics.length) syllabus = flattenTopics(topics);
      } catch {
        syllabus = undefined;
      }
    }

    let generated: GeneratedQuestion[] = [];
    try {
      generated = await generateQuestions({
        examName: args.examName,
        subject: args.subject,
        topic: args.topicPath,
        count: args.questionCount,
        preferredLanguage: args.preferredLanguage ?? null,
        syllabus,
        strictSyllabus: Boolean(args.syllabusOverride?.length),
        difficulty: args.difficulty
      });
    } catch {
      generated = fallbackQuestions({
        examName: args.examName,
        subject: args.subject,
        topic: args.topicPath,
        count: args.questionCount,
        syllabus,
        difficulty: args.difficulty
      });
    }

    const merged = dedupeQuestions([...reusableQuestions, ...bankQuestions, ...generated])
      .filter((question) => !isPlaceholderQuestion(question))
      .slice(0, args.questionCount);

    if (merged.length < args.questionCount) {
      const filler = fallbackQuestions({
        examName: args.examName,
        subject: args.subject,
        topic: args.topicPath,
        count: args.questionCount,
        syllabus,
        difficulty: args.difficulty
      });
      for (const question of filler) {
        if (merged.length >= args.questionCount) break;
        if (isPlaceholderQuestion(question)) continue;
        const key = questionKey(question);
        const exists = merged.some((entry) => questionKey(entry) === key);
        if (exists) continue;
        merged.push(question);
      }
    }

    if (!merged.length) {
      throw new Error("Question generation failed.");
    }

    await insertQuizQuestions({
      firebase,
      quizId,
      questions: merged
    });

    return quizId;
  } catch (error) {
    await deleteQuizRecord({ firebase, quizId });
    throw error;
  }
}
