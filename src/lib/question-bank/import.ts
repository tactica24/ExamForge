import "server-only";

import { createHash, randomUUID } from "crypto";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";
import { type GeneratedQuestion, isPlaceholderQuestion } from "@/lib/quizzes/questions";
import { getTopicsForExamSubject, type SyllabusTopic } from "@/lib/syllabi/get";

type Difficulty = "easy" | "medium" | "hard";
type ReviewStatus = "approved" | "needs_review" | "rejected";

type ImportedQuestion = GeneratedQuestion & {
  difficulty: Difficulty;
  topicPath?: string;
  focusLabel?: string;
};

type AssignmentTarget = {
  topicPath: string;
  topicKey: string;
  focusLabel: string;
  focusKey: string;
  syllabus: string[];
  syllabusTags: string[];
};

type ReviewResult = {
  qualityScore: number;
  reviewScore: number;
  reviewStatus: ReviewStatus;
  reviewNotes: string[];
};

export type QuestionBankImportResult = {
  runId: string;
  totalSubmitted: number;
  totalParsed: number;
  totalStored: number;
  totalApproved: number;
  totalNeedsReview: number;
  totalRejected: number;
  duplicatesSkipped: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "their",
  "this",
  "that",
  "these",
  "those",
  "to",
  "was",
  "were",
  "which",
  "with"
]);

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
  return normalizeText(value, 1200)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
}

function overlapCount(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).length;
}

function questionSignature(question: Pick<GeneratedQuestion, "question" | "options">) {
  const stem = normalizeText(question.question, 500).toLowerCase();
  const options = (question.options ?? []).map((option) => normalizeText(option, 180).toLowerCase()).join("|");
  return `${stem}|${options}`;
}

function normalizeDifficulty(value: unknown): Difficulty {
  const text = normalizeText(value, 40).toLowerCase();
  if (text === "easy" || text === "hard") return text;
  return "medium";
}

function unwrapPayloadJson(payload: string) {
  const trimmed = String(payload ?? "").trim();
  if (!trimmed) throw new Error("Paste a JSON array or an object with a questions array.");

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const raw = fenced ? fenced[1] ?? "" : trimmed;

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON. Paste a JSON array or {\"questions\": [...]}.");
  }
}

function extractOptions(raw: Record<string, unknown>) {
  if (Array.isArray(raw.options)) {
    return raw.options.map((option) => normalizeText(option, 180)).filter(Boolean).slice(0, 4);
  }

  if (Array.isArray(raw.choices)) {
    return raw.choices.map((option) => normalizeText(option, 180)).filter(Boolean).slice(0, 4);
  }

  const optionKeys = ["option_a", "option_b", "option_c", "option_d"] as const;
  const letterKeys = ["A", "B", "C", "D"] as const;
  const collected = optionKeys
    .map((key, index) => raw[key] ?? raw[letterKeys[index]])
    .map((option) => normalizeText(option, 180))
    .filter(Boolean)
    .slice(0, 4);

  return collected;
}

function extractCorrectIndex(raw: Record<string, unknown>, options: string[]) {
  const numericIndex = Number(raw.correct_index);
  if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex <= 3) {
    return numericIndex;
  }

  const answerIndex = Number(raw.answer_index);
  if (Number.isInteger(answerIndex) && answerIndex >= 1 && answerIndex <= 4) {
    return answerIndex - 1;
  }

  const answerLetter = normalizeText(raw.answer ?? raw.correct_answer ?? "", 30).toUpperCase();
  if (/^[ABCD]$/.test(answerLetter)) {
    return answerLetter.charCodeAt(0) - 65;
  }

  const answerText = normalizeText(raw.answer_text ?? raw.answer ?? raw.correct_answer ?? "", 180).toLowerCase();
  if (answerText) {
    const matchedIndex = options.findIndex((option) => option.toLowerCase() === answerText);
    if (matchedIndex >= 0) return matchedIndex;
  }

  return null;
}

function normalizeImportedQuestion(raw: unknown): ImportedQuestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const question = normalizeText(record.question ?? record.stem ?? record.prompt, 500);
  const options = extractOptions(record);
  const correctIndex = extractCorrectIndex(record, options);
  const explanation = normalizeText(
    record.explanation ?? record.solution ?? record.reason ?? (correctIndex !== null ? `Correct answer: ${options[correctIndex]}.` : ""),
    800
  );

  if (!question || options.length !== 4 || correctIndex === null) return null;

  const normalized: ImportedQuestion = {
    question,
    options,
    correct_index: correctIndex,
    explanation,
    difficulty: normalizeDifficulty(record.difficulty),
    topicPath: normalizeText(record.topic_path ?? record.topic, 180) || undefined,
    focusLabel: normalizeText(record.focus_label ?? record.focus ?? record.subtopic, 180) || undefined
  };

  if (isPlaceholderQuestion(normalized)) return null;
  if (new Set(normalized.options.map((option) => option.toLowerCase())).size !== normalized.options.length) return null;

  return normalized;
}

export function parseImportedQuestions(payload: string) {
  const parsed = unwrapPayloadJson(payload);
  const sourceRows: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown[] }).questions)
      ? ((parsed as { questions: unknown[] }).questions ?? [])
      : [];
  const questions = sourceRows
    .map((entry: unknown) => normalizeImportedQuestion(entry))
    .filter((entry): entry is ImportedQuestion => Boolean(entry));

  return {
    totalSubmitted: Array.isArray(sourceRows) ? sourceRows.length : 0,
    questions
  };
}

function buildAssignmentTargets(topics: SyllabusTopic[]) {
  const targets: AssignmentTarget[] = [];

  for (const topic of topics) {
    const title = normalizeText(topic.title || topic.path, 180);
    const path = normalizeText(topic.path || topic.title, 180) || title;
    const subtopics = Array.isArray(topic.subtopics)
      ? topic.subtopics.map((entry) => normalizeText(entry, 140)).filter(Boolean)
      : [];
    const syllabus = uniqueStrings([title, path, ...subtopics]).slice(0, 14);
    const syllabusTags = uniqueStrings(tokenize([title, path, ...subtopics].join(" "))).slice(0, 24);

    if (path) {
      targets.push({
        topicPath: path,
        topicKey: normalizeKey(path),
        focusLabel: title || path,
        focusKey: normalizeKey(title || path),
        syllabus,
        syllabusTags
      });
    }

    for (const subtopic of subtopics.slice(0, 6)) {
      targets.push({
        topicPath: path,
        topicKey: normalizeKey(path),
        focusLabel: subtopic,
        focusKey: normalizeKey(subtopic),
        syllabus: uniqueStrings([subtopic, ...syllabus]).slice(0, 14),
        syllabusTags: uniqueStrings([...tokenize(subtopic), ...syllabusTags]).slice(0, 24)
      });
    }
  }

  const dedupedKeys = uniqueStrings(targets.map((target) => `${target.topicKey}|${target.focusKey}`));
  return dedupedKeys.map((key) => targets.find((target) => `${target.topicKey}|${target.focusKey}` === key)!);
}

export function assignImportedQuestionTarget(args: {
  question: ImportedQuestion;
  subject: string;
  targets: AssignmentTarget[];
}) {
  if (!args.targets.length) {
    return {
      topicPath: args.question.topicPath || args.subject,
      topicKey: normalizeKey(args.question.topicPath || args.subject),
      focusLabel: args.question.focusLabel || args.question.topicPath || args.subject,
      focusKey: normalizeKey(args.question.focusLabel || args.question.topicPath || args.subject),
      syllabus: uniqueStrings([args.subject, args.question.topicPath || "", args.question.focusLabel || ""]).filter(Boolean),
      syllabusTags: uniqueStrings(tokenize([args.subject, args.question.topicPath, args.question.focusLabel].join(" ")))
    } satisfies AssignmentTarget;
  }

  const explicitTopicKey = normalizeKey(args.question.topicPath);
  const explicitFocusKey = normalizeKey(args.question.focusLabel);
  const questionTokens = uniqueStrings(
    tokenize([args.subject, args.question.question, args.question.explanation, args.question.options.join(" ")].join(" "))
  );

  const ranked = args.targets
    .map((target) => {
      let score = 0;
      score += overlapCount(questionTokens, target.syllabusTags) * 5;
      score += overlapCount(questionTokens, tokenize(target.topicPath)) * 8;
      score += overlapCount(questionTokens, tokenize(target.focusLabel)) * 10;

      if (
        explicitTopicKey &&
        (target.topicKey === explicitTopicKey ||
          target.topicKey.includes(explicitTopicKey) ||
          explicitTopicKey.includes(target.topicKey))
      ) {
        score += 80;
      }

      if (
        explicitFocusKey &&
        (target.focusKey === explicitFocusKey ||
          target.focusKey.includes(explicitFocusKey) ||
          explicitFocusKey.includes(target.focusKey))
      ) {
        score += 65;
      }

      return { target, score };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.target ?? args.targets[0]!;
}

export function reviewImportedQuestion(args: {
  question: GeneratedQuestion;
  subject: string;
  topicPath: string;
  focusLabel: string;
  syllabusTags: string[];
  approvalThreshold: number;
}): ReviewResult {
  const stem = normalizeText(args.question.question, 500);
  const options = Array.isArray(args.question.options)
    ? args.question.options.map((option) => normalizeText(option, 180)).filter(Boolean)
    : [];
  const explanation = normalizeText(args.question.explanation, 800);
  const topicTokens = uniqueStrings(tokenize([args.subject, args.topicPath, args.focusLabel].join(" ")));
  const questionTokens = uniqueStrings(tokenize([stem, explanation, options.join(" ")].join(" ")));

  let score = 35;
  const notes: string[] = [];

  if (isPlaceholderQuestion(args.question)) {
    return {
      qualityScore: 0,
      reviewScore: 0,
      reviewStatus: "rejected",
      reviewNotes: ["Rejected placeholder or meta-style question."]
    };
  }

  if (options.length === 4) {
    score += 14;
  } else {
    notes.push("Question does not have exactly four options.");
    score -= 18;
  }

  if (new Set(options.map((option) => option.toLowerCase())).size === options.length) {
    score += 8;
  } else {
    notes.push("Options are duplicated or too similar.");
    score -= 10;
  }

  if (stem.length >= 18 && stem.length <= 240) {
    score += 10;
  } else {
    notes.push("Question stem length looks unusual.");
    score -= 6;
  }

  if (explanation.length >= 18) {
    score += 8;
  } else {
    notes.push("Explanation is too short.");
    score -= 6;
  }

  if (Number.isInteger(args.question.correct_index) && args.question.correct_index >= 0 && args.question.correct_index <= 3) {
    score += 5;
  } else {
    notes.push("Correct answer index is invalid.");
    score -= 15;
  }

  const topicOverlap = overlapCount(questionTokens, topicTokens);
  if (topicOverlap >= 3) {
    score += 16;
  } else if (topicOverlap >= 1) {
    score += 8;
    notes.push("Topic coverage is only loosely signalled.");
  } else {
    notes.push("Question text does not clearly align to the selected syllabus focus.");
    score -= 14;
  }

  const syllabusOverlap = overlapCount(questionTokens, args.syllabusTags);
  if (syllabusOverlap >= 2) {
    score += 10;
  } else if (args.syllabusTags.length) {
    notes.push("Weak syllabus-tag overlap.");
    score -= 8;
  }

  if (/all of the above|none of the above/i.test(stem) || options.some((option) => /all of the above|none of the above/i.test(option))) {
    notes.push("Contains low-value omnibus option pattern.");
    score -= 6;
  }

  if (options.some((option) => option.length < 2 || option.length > 140)) {
    notes.push("One or more options have poor formatting length.");
    score -= 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const reviewThreshold = Math.max(55, Math.min(100, Math.trunc(args.approvalThreshold || 78)));
  const reviewStatus: ReviewStatus =
    score >= reviewThreshold ? "approved" : score >= Math.max(60, reviewThreshold - 15) ? "needs_review" : "rejected";

  if (reviewStatus === "approved" && !notes.length) {
    notes.push("Auto-approved by import structure and syllabus checks.");
  }

  return {
    qualityScore: score,
    reviewScore: score,
    reviewStatus,
    reviewNotes: notes.slice(0, 6)
  };
}

async function loadExistingSignatures(args: { examId: string; subject: string }) {
  const admin = createFirebaseAdminClient();
  const { data, error } = await admin
    .from("question_bank_entries")
    .select("signature")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row: any) => normalizeText(row?.signature, 800)).filter(Boolean));
}

async function insertEntryChunk(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const admin = createFirebaseAdminClient();
  const { error } = await admin.from("question_bank_entries").insert(rows);
  if (error) throw new Error(error.message);
}

export async function importQuestionsToBank(args: {
  examId: string;
  examSlug: string;
  examName: string;
  subject: string;
  payload: string;
  createdBy?: string | null;
  approvalThreshold?: number;
}) {
  const admin = createFirebaseAdminClient();
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const threshold = Math.max(50, Math.min(100, Math.trunc(args.approvalThreshold ?? 76)));
  const parsed = parseImportedQuestions(args.payload);

  if (!parsed.totalSubmitted) {
    throw new Error("No questions were found in the JSON payload.");
  }

  if (!parsed.questions.length) {
    throw new Error("The JSON was read, but none of the entries matched the required question format.");
  }

  const { error: insertRunError } = await admin.from("question_bank_runs").insert({
    id: runId,
    exam_id: args.examId,
    exam_slug: args.examSlug,
    subject: args.subject,
    status: "running",
    total_requested: parsed.totalSubmitted,
    total_generated: parsed.questions.length,
    total_approved: 0,
    total_needs_review: 0,
    total_rejected: 0,
    config: {
      source: "external_json_import",
      approval_threshold: threshold,
      exam_name: args.examName
    },
    summary: {
      started_at: startedAt
    },
    created_by: args.createdBy ?? null
  });

  if (insertRunError) throw new Error(insertRunError.message);

  try {
    const topics = await getTopicsForExamSubject({
      examId: args.examId,
      examSlug: args.examSlug,
      subject: args.subject
    });
    const targets = buildAssignmentTargets(topics);
    const existingSignatures = await loadExistingSignatures({
      examId: args.examId,
      subject: args.subject
    });

    const importSignatures = new Set<string>();
    const pendingRows: Record<string, unknown>[] = [];
    let totalStored = 0;
    let totalApproved = 0;
    let totalNeedsReview = 0;
    let totalRejected = 0;
    let duplicatesSkipped = 0;

    const flushPendingRows = async () => {
      if (!pendingRows.length) return;
      await insertEntryChunk(pendingRows.splice(0, pendingRows.length));
    };

    for (const question of parsed.questions) {
      const signature = questionSignature(question);
      if (!signature || existingSignatures.has(signature) || importSignatures.has(signature)) {
        duplicatesSkipped += 1;
        continue;
      }

      importSignatures.add(signature);
      existingSignatures.add(signature);

      const assigned = assignImportedQuestionTarget({
        question,
        subject: args.subject,
        targets
      });
      const review = reviewImportedQuestion({
        question,
        subject: args.subject,
        topicPath: assigned.topicPath,
        focusLabel: assigned.focusLabel,
        syllabusTags: assigned.syllabusTags,
        approvalThreshold: threshold
      });

      if (review.reviewStatus === "approved") totalApproved += 1;
      if (review.reviewStatus === "needs_review") totalNeedsReview += 1;
      if (review.reviewStatus === "rejected") totalRejected += 1;

      pendingRows.push({
        id: randomUUID(),
        run_id: runId,
        exam_id: args.examId,
        exam_slug: args.examSlug,
        subject: args.subject,
        topic_path: assigned.topicPath,
        topic_key: assigned.topicKey,
        focus_label: assigned.focusLabel,
        focus_key: assigned.focusKey,
        difficulty: question.difficulty,
        question: normalizeText(question.question, 500),
        options: question.options.slice(0, 4),
        correct_index: question.correct_index,
        explanation: normalizeText(question.explanation, 800),
        syllabus_tags: assigned.syllabusTags,
        quality_score: review.qualityScore,
        review_score: review.reviewScore,
        review_status: review.reviewStatus,
        review_notes: review.reviewNotes,
        source_model: null,
        source_provider: "external",
        source_type: "external_json_import",
        signature,
        meta: {
          imported_from: "admin_json_paste",
          original_topic_path: question.topicPath ?? null,
          original_focus_label: question.focusLabel ?? null,
          assigned_syllabus: assigned.syllabus
        }
      });
      totalStored += 1;

      if (pendingRows.length >= 36) {
        await flushPendingRows();
      }
    }

    await flushPendingRows();

    const signatureHash = createHash("sha256")
      .update(`${args.examId}|${args.subject}|${totalStored}|${startedAt}|json-import`)
      .digest("hex")
      .slice(0, 16);

    const { error: updateError } = await admin
      .from("question_bank_runs")
      .update({
        status: "completed",
        total_requested: parsed.totalSubmitted,
        total_generated: parsed.questions.length,
        total_approved: totalApproved,
        total_needs_review: totalNeedsReview,
        total_rejected: totalRejected,
        summary: {
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          source: "external_json_import",
          submitted_count: parsed.totalSubmitted,
          parsed_count: parsed.questions.length,
          stored_count: totalStored,
          duplicates_skipped: duplicatesSkipped,
          syllabus_topic_count: topics.length,
          signature_hash: signatureHash
        }
      })
      .eq("id", runId);

    if (updateError) throw new Error(updateError.message);

    return {
      runId,
      totalSubmitted: parsed.totalSubmitted,
      totalParsed: parsed.questions.length,
      totalStored,
      totalApproved,
      totalNeedsReview,
      totalRejected,
      duplicatesSkipped
    } satisfies QuestionBankImportResult;
  } catch (error) {
    await admin
      .from("question_bank_runs")
      .update({
        status: "failed",
        summary: {
          started_at: startedAt,
          failed_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : "question_bank_import_failed",
          source: "external_json_import"
        }
      })
      .eq("id", runId);

    throw error;
  }
}
