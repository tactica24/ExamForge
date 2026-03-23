import "server-only";

import { createHash, randomUUID } from "crypto";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";
import {
  fallbackQuestions,
  generateQuestions,
  isPlaceholderQuestion,
  type GeneratedQuestion
} from "@/lib/quizzes/questions";
import { getTopicsForExamSubject, type SyllabusTopic } from "@/lib/syllabi/get";

type Difficulty = "easy" | "medium" | "hard";
type ReviewStatus = "approved" | "needs_review" | "rejected";

type GenerationTarget = {
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

export type QuestionBankGenerationResult = {
  runId: string;
  totalRequested: number;
  totalGenerated: number;
  totalStored: number;
  totalApproved: number;
  totalNeedsReview: number;
  totalRejected: number;
  targetCount: number;
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

function questionSignature(question: Pick<GeneratedQuestion, "question" | "options">) {
  const stem = normalizeText(question.question, 500).toLowerCase();
  const options = (question.options ?? []).map((option) => normalizeText(option, 180).toLowerCase()).join("|");
  return `${stem}|${options}`;
}

function tokenize(value: unknown) {
  return normalizeText(value, 800)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
}

function buildDifficultyPlan(total: number): Difficulty[] {
  const amount = Math.max(1, Math.min(30, Math.trunc(total || 1)));
  const cycle: Difficulty[] = ["easy", "medium", "hard"];
  return Array.from({ length: amount }, (_, index) => cycle[index % cycle.length] as Difficulty);
}

function buildGenerationTargets(topics: SyllabusTopic[], focusLimit: number) {
  const targets: GenerationTarget[] = [];

  for (const topic of topics) {
    const title = normalizeText(topic.title || topic.path, 180);
    const path = normalizeText(topic.path || topic.title, 180) || title;
    const subtopics = Array.isArray(topic.subtopics)
      ? topic.subtopics.map((entry) => normalizeText(entry, 140)).filter(Boolean)
      : [];
    const syllabus = uniqueStrings([title, path, ...subtopics]).slice(0, 12);
    const syllabusTags = uniqueStrings(tokenize([title, path, ...subtopics].join(" "))).slice(0, 18);

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

    for (const subtopic of subtopics.slice(0, 4)) {
      targets.push({
        topicPath: path,
        topicKey: normalizeKey(path),
        focusLabel: subtopic,
        focusKey: normalizeKey(subtopic),
        syllabus: uniqueStrings([subtopic, ...syllabus]).slice(0, 12),
        syllabusTags: uniqueStrings([...tokenize(subtopic), ...syllabusTags]).slice(0, 18)
      });
    }
  }

  const deduped = uniqueStrings(targets.map((target) => `${target.topicKey}|${target.focusKey}`)).map((key) => {
    return targets.find((target) => `${target.topicKey}|${target.focusKey}` === key)!;
  });

  return deduped.slice(0, Math.max(1, Math.min(80, Math.trunc(focusLimit || deduped.length || 1))));
}

function overlapCount(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).length;
}

function reviewQuestion(args: {
  question: GeneratedQuestion;
  subject: string;
  topicPath: string;
  focusLabel: string;
  syllabusTags: string[];
  approvalThreshold: number;
}): ReviewResult {
  const question = args.question;
  const stem = normalizeText(question.question, 500);
  const options = Array.isArray(question.options)
    ? question.options.map((option) => normalizeText(option, 180)).filter(Boolean)
    : [];
  const explanation = normalizeText(question.explanation, 800);
  const topicTokens = uniqueStrings(tokenize([args.subject, args.topicPath, args.focusLabel].join(" ")));
  const questionTokens = uniqueStrings(tokenize([stem, explanation, options.join(" ")].join(" ")));

  let score = 35;
  const notes: string[] = [];

  if (isPlaceholderQuestion(question)) {
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

  if (Number.isInteger(question.correct_index) && question.correct_index >= 0 && question.correct_index <= 3) {
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
  } else if (!args.syllabusTags.length) {
    score += 0;
  } else {
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
    notes.push("Auto-approved by syllabus and structure checks.");
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

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row: any) => normalizeText(row?.signature, 800)).filter(Boolean));
}

async function insertEntryChunk(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const admin = createFirebaseAdminClient();
  const { error } = await admin.from("question_bank_entries").insert(rows);
  if (error) throw new Error(error.message);
}

export async function generateQuestionBankForSubject(args: {
  examId: string;
  examSlug: string;
  examName: string;
  subject: string;
  focusLimit: number;
  questionsPerFocus: number;
  approvalThreshold: number;
  createdBy?: string | null;
}) {
  const admin = createFirebaseAdminClient();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  const runConfig = {
    focus_limit: Math.max(1, Math.min(80, Math.trunc(args.focusLimit || 12))),
    questions_per_focus: Math.max(1, Math.min(24, Math.trunc(args.questionsPerFocus || 9))),
    approval_threshold: Math.max(50, Math.min(100, Math.trunc(args.approvalThreshold || 78))),
    difficulty_mode: "balanced"
  };

  const { error: insertRunError } = await admin.from("question_bank_runs").insert({
    id: runId,
    exam_id: args.examId,
    exam_slug: args.examSlug,
    subject: args.subject,
    status: "running",
    total_requested: 0,
    total_generated: 0,
    total_approved: 0,
    total_needs_review: 0,
    total_rejected: 0,
    config: runConfig,
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
    const targets = buildGenerationTargets(topics, runConfig.focus_limit);
    const difficultyPlan = buildDifficultyPlan(runConfig.questions_per_focus);
    const existingSignatures = await loadExistingSignatures({
      examId: args.examId,
      subject: args.subject
    });

    let totalGenerated = 0;
    let totalStored = 0;
    let totalApproved = 0;
    let totalNeedsReview = 0;
    let totalRejected = 0;
    const pendingRows: Record<string, unknown>[] = [];

    for (const target of targets) {
      const perDifficulty = difficultyPlan.reduce(
        (acc, difficulty) => {
          acc[difficulty] += 1;
          return acc;
        },
        { easy: 0, medium: 0, hard: 0 } as Record<Difficulty, number>
      );

      for (const difficulty of ["easy", "medium", "hard"] as Difficulty[]) {
        const requested = perDifficulty[difficulty];
        if (!requested) continue;

        let generated: GeneratedQuestion[] = [];
        try {
          generated = await generateQuestions({
            examName: args.examName,
            subject: args.subject,
            topic: `${target.topicPath}: ${target.focusLabel}`,
            count: requested,
            syllabus: target.syllabus,
            strictSyllabus: true,
            difficulty
          });
        } catch {
          generated = fallbackQuestions({
            examName: args.examName,
            subject: args.subject,
            topic: `${target.topicPath}: ${target.focusLabel}`,
            count: requested,
            syllabus: target.syllabus,
            difficulty
          });
        }

        totalGenerated += generated.length;

        for (const question of generated) {
          const signature = questionSignature(question);
          if (!signature || existingSignatures.has(signature)) continue;
          existingSignatures.add(signature);

          const review = reviewQuestion({
            question,
            subject: args.subject,
            topicPath: target.topicPath,
            focusLabel: target.focusLabel,
            syllabusTags: target.syllabusTags,
            approvalThreshold: runConfig.approval_threshold
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
            topic_path: target.topicPath,
            topic_key: target.topicKey,
            focus_label: target.focusLabel,
            focus_key: target.focusKey,
            difficulty,
            question: normalizeText(question.question, 500),
            options: question.options.slice(0, 4),
            correct_index: question.correct_index,
            explanation: normalizeText(question.explanation, 800),
            syllabus_tags: target.syllabusTags,
            quality_score: review.qualityScore,
            review_score: review.reviewScore,
            review_status: review.reviewStatus,
            review_notes: review.reviewNotes,
            source_model: null,
            source_provider: null,
            source_type: "ai_pipeline",
            signature,
            meta: {
              topic_focus: target.focusLabel,
              topic_syllabus: target.syllabus,
              generated_from: "admin_question_bank_pipeline"
            }
          });
          totalStored += 1;

          if (pendingRows.length >= 36) {
            await insertEntryChunk(pendingRows.splice(0, pendingRows.length));
          }
        }
      }
    }

    if (pendingRows.length) {
      await insertEntryChunk(pendingRows);
    }

    const summary = {
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      target_count: targets.length,
      syllabus_topics: topics.length,
      stored: totalStored,
      approved: totalApproved,
      needs_review: totalNeedsReview,
      rejected: totalRejected,
      request_plan: {
        per_focus: runConfig.questions_per_focus,
        difficulty_distribution: buildDifficultyPlan(runConfig.questions_per_focus)
      },
      signature_hash: createHash("sha256")
        .update(`${args.examId}|${args.subject}|${totalStored}|${startedAt}`)
        .digest("hex")
        .slice(0, 16)
    };

    const { error: updateRunError } = await admin
      .from("question_bank_runs")
      .update({
        status: "completed",
        total_requested: targets.length * runConfig.questions_per_focus,
        total_generated: totalGenerated,
        total_approved: totalApproved,
        total_needs_review: totalNeedsReview,
        total_rejected: totalRejected,
        summary
      })
      .eq("id", runId);

    if (updateRunError) throw new Error(updateRunError.message);

    return {
      runId,
      totalRequested: targets.length * runConfig.questions_per_focus,
      totalGenerated,
      totalStored,
      totalApproved,
      totalNeedsReview,
      totalRejected,
      targetCount: targets.length
    } satisfies QuestionBankGenerationResult;
  } catch (error) {
    await admin
      .from("question_bank_runs")
      .update({
        status: "failed",
        summary: {
          started_at: startedAt,
          failed_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : "question_bank_generation_failed"
        }
      })
      .eq("id", runId);
    throw error;
  }
}
