import "server-only";

import { createHash } from "crypto";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { type GeneratedQuestion } from "@/lib/quizzes/questions";

type Difficulty = "easy" | "medium" | "hard";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeKey(value: unknown) {
  return normalizeText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function tokenize(value: unknown) {
  return normalizeText(value, 800)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function questionSignature(question: Pick<GeneratedQuestion, "question" | "options">) {
  return `${normalizeText(question.question, 500).toLowerCase()}|${(question.options ?? [])
    .map((option) => normalizeText(option, 180).toLowerCase())
    .join("|")}`;
}

function normalizeQuestionRow(row: any): GeneratedQuestion | null {
  const question = normalizeText(row?.question, 500);
  const options = Array.isArray(row?.options)
    ? row.options.map((option: unknown) => normalizeText(option, 180)).filter(Boolean).slice(0, 4)
    : [];
  const correctIndex = Math.max(0, Math.min(3, Number(row?.correct_index ?? 0)));
  const explanation = normalizeText(row?.explanation, 800);

  if (!question || options.length !== 4) return null;

  return {
    question,
    options,
    correct_index: correctIndex,
    explanation
  };
}

function seededSort<T>(items: T[], seed: string, score: (item: T) => number) {
  return [...items].sort((left, right) => {
    const scoreDiff = score(right) - score(left);
    if (scoreDiff !== 0) return scoreDiff;

    const leftHash = createHash("sha256")
      .update(`${seed}|${JSON.stringify(left)}`)
      .digest("hex");
    const rightHash = createHash("sha256")
      .update(`${seed}|${JSON.stringify(right)}`)
      .digest("hex");
    return leftHash.localeCompare(rightHash);
  });
}

async function fetchQuestionsForQuizIds(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  quizIds: string[];
}) {
  const rows: any[] = [];
  for (const batch of chunk(args.quizIds, 60)) {
    const { data } = await args.firebase
      .from("quiz_questions")
      .select("quiz_id,question,options")
      .in("quiz_id", batch);
    if (data?.length) rows.push(...data);
  }
  return rows;
}

async function loadSeenSignatures(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  examId: string;
  subject: string;
}) {
  const seen = new Set<string>();
  const { data: quizzes } = await args.firebase
    .from("quizzes")
    .select("id")
    .eq("created_by", args.userId)
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .limit(80);

  const quizIds = (quizzes ?? []).map((row: any) => normalizeText(row?.id, 120)).filter(Boolean);
  if (!quizIds.length) return seen;

  const rows = await fetchQuestionsForQuizIds({
    firebase: args.firebase,
    quizIds
  });
  for (const row of rows) {
    const normalized = normalizeQuestionRow(row);
    if (!normalized) continue;
    seen.add(questionSignature(normalized));
  }
  return seen;
}

function relevanceScore(args: {
  row: any;
  topicKey: string;
  focusKey: string;
  queryTokens: string[];
  syllabusTokens: string[];
  difficulty: Difficulty;
}) {
  const rowTokens = [
    ...tokenize(row?.question),
    ...tokenize(row?.topic_path),
    ...tokenize(row?.focus_label),
    ...(Array.isArray(row?.syllabus_tags) ? row.syllabus_tags.flatMap((tag: unknown) => tokenize(tag)) : [])
  ];
  let score = Number(row?.quality_score ?? 0);

  if (normalizeKey(row?.topic_key ?? row?.topic_path) === args.topicKey) score += 80;
  if (normalizeKey(row?.focus_key ?? row?.focus_label) === args.focusKey) score += 40;
  if (String(row?.difficulty ?? "") === args.difficulty) score += 18;

  const rowSet = new Set(rowTokens);
  score += args.queryTokens.filter((token) => rowSet.has(token)).length * 7;
  score += args.syllabusTokens.filter((token) => rowSet.has(token)).length * 4;

  return score;
}

async function fetchCandidates(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  examId: string;
  subject: string;
  difficulty: Difficulty;
  topicKey: string;
  focusKey: string;
}) {
  const fields =
    "question,options,correct_index,explanation,signature,topic_path,topic_key,focus_label,focus_key,syllabus_tags,difficulty,quality_score";

  const queries = [
    args.firebase
      .from("question_bank_entries")
      .select(fields)
      .eq("exam_id", args.examId)
      .eq("subject", args.subject)
      .eq("review_status", "approved")
      .eq("topic_key", args.topicKey)
      .eq("difficulty", args.difficulty)
      .limit(140),
    args.firebase
      .from("question_bank_entries")
      .select(fields)
      .eq("exam_id", args.examId)
      .eq("subject", args.subject)
      .eq("review_status", "approved")
      .eq("focus_key", args.focusKey)
      .limit(140),
    args.firebase
      .from("question_bank_entries")
      .select(fields)
      .eq("exam_id", args.examId)
      .eq("subject", args.subject)
      .eq("review_status", "approved")
      .eq("difficulty", args.difficulty)
      .limit(260),
    args.firebase
      .from("question_bank_entries")
      .select(fields)
      .eq("exam_id", args.examId)
      .eq("subject", args.subject)
      .eq("review_status", "approved")
      .limit(320)
  ];

  const rows: any[] = [];
  for (const query of queries) {
    const { data } = await query;
    if (data?.length) rows.push(...data);
  }
  return rows;
}

export async function pickQuestionBankQuestions(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  examId: string;
  subject: string;
  topicPath: string;
  difficulty: Difficulty;
  questionCount: number;
  syllabus?: string[];
}) {
  const needed = Math.max(1, Math.min(80, Math.trunc(args.questionCount || 1)));
  const topicKey = normalizeKey(args.topicPath);
  const focusKey = normalizeKey(String(args.topicPath).split(":").pop() ?? args.topicPath);
  const queryTokens = tokenize([args.subject, args.topicPath].join(" "));
  const syllabusTokens = Array.isArray(args.syllabus) ? args.syllabus.flatMap((item) => tokenize(item)).slice(0, 24) : [];

  const [rows, seenSignatures] = await Promise.all([
    fetchCandidates({
      firebase: args.firebase,
      examId: args.examId,
      subject: args.subject,
      difficulty: args.difficulty,
      topicKey,
      focusKey
    }),
    loadSeenSignatures({
      firebase: args.firebase,
      userId: args.userId,
      examId: args.examId,
      subject: args.subject
    })
  ]);

  const candidates = rows
    .map((row) => {
      const normalized = normalizeQuestionRow(row);
      const signature = normalizeText(row?.signature, 800) || (normalized ? questionSignature(normalized) : "");
      return { row, normalized, signature };
    })
    .filter((candidate) => Boolean(candidate.signature) && Boolean(candidate.normalized));

  const deduped = candidates.filter(
    (candidate, index, all) => all.findIndex((entry) => entry.signature === candidate.signature) === index
  );

  const unseen = deduped.filter((candidate) => !seenSignatures.has(candidate.signature));
  const seen = deduped.filter((candidate) => seenSignatures.has(candidate.signature));
  const seed = `${args.userId}|${args.examId}|${args.subject}|${args.topicPath}|${args.difficulty}`;

  const ordered = [
    ...seededSort(unseen, `${seed}|unseen`, (candidate) =>
      relevanceScore({ row: candidate.row, topicKey, focusKey, queryTokens, syllabusTokens, difficulty: args.difficulty })
    ),
    ...seededSort(seen, `${seed}|seen`, (candidate) =>
      relevanceScore({ row: candidate.row, topicKey, focusKey, queryTokens, syllabusTokens, difficulty: args.difficulty })
    )
  ];

  const questions: GeneratedQuestion[] = [];
  const signatures = new Set<string>();

  for (const candidate of ordered) {
    const normalized = candidate.normalized;
    if (!normalized) continue;
    const signature = candidate.signature;
    if (!signature || signatures.has(signature)) continue;
    signatures.add(signature);
    questions.push(normalized);
    if (questions.length >= needed) break;
  }

  return questions;
}
