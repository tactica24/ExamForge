import "server-only";

import { randomUUID } from "node:crypto";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { regenerateSyllabusWithAiDetailed } from "@/lib/syllabi/get";

type SyllabusJobPayload = {
  exam_id: string;
  exam_slug: string;
  subject: string;
};

type AiJobRow = {
  id: string;
  job_type: string;
  status: string;
  payload?: unknown;
  attempts?: number;
  max_attempts?: number;
  run_after?: string;
  created_by?: string | null;
};

const AI_JOB_TYPE_SYLLABUS = "syllabus_generate_subject";

function toIso(date: Date) {
  return date.toISOString();
}

function parsePayload(value: unknown): SyllabusJobPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const exam_id = String(row.exam_id ?? "").trim();
  const exam_slug = String(row.exam_slug ?? "").trim();
  const subject = String(row.subject ?? "").trim();
  if (!exam_id || !exam_slug || !subject) return null;
  return { exam_id, exam_slug, subject };
}

function retryBackoffMs(attempt: number) {
  const minutes = Math.min(60, 5 * Math.pow(2, Math.max(0, attempt - 1)));
  return minutes * 60 * 1000;
}

export async function enqueueSyllabusGenerationJobs(args: {
  examId: string;
  examSlug: string;
  subjects: string[];
  createdBy?: string | null;
}) {
  const admin = createBackendAdminClient();
  const now = new Date();
  const uniqueSubjects = Array.from(
    new Set(
      args.subjects
        .map((subject) => String(subject).trim())
        .filter(Boolean)
    )
  );

  if (!uniqueSubjects.length) return { enqueued: 0, ids: [] as string[] };

  const rows = uniqueSubjects.map((subject) => ({
    id: randomUUID(),
    job_type: AI_JOB_TYPE_SYLLABUS,
    status: "queued",
    payload: {
      exam_id: args.examId,
      exam_slug: args.examSlug,
      subject
    },
    attempts: 0,
    max_attempts: 3,
    run_after: toIso(now),
    created_by: args.createdBy ?? null,
    result_meta: null,
    last_error: null
  }));

  const { error } = await admin.from("ai_jobs").insert(rows);
  if (error) throw new Error(error.message ?? "Failed to enqueue AI jobs.");

  return { enqueued: rows.length, ids: rows.map((row) => row.id) };
}

export async function processPendingAiJobs(args?: { limit?: number }) {
  const admin = createBackendAdminClient();
  const limit = Math.max(1, Math.min(200, Number(args?.limit ?? 30)));
  const now = new Date();
  const nowIso = toIso(now);

  const { data: candidates, error } = await admin
    .from("ai_jobs")
    .select("*")
    .eq("status", "queued")
    .lte("run_after", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message ?? "Failed to load AI jobs.");

  let processed = 0;
  let completed = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of (candidates ?? []) as AiJobRow[]) {
    const payload = parsePayload(job.payload);
    if (!payload || job.job_type !== AI_JOB_TYPE_SYLLABUS) {
      await admin
        .from("ai_jobs")
        .update({
          status: "failed",
          completed_at: toIso(new Date()),
          last_error: "invalid_job_payload"
        })
        .eq("id", job.id)
        .eq("status", "queued");
      failed += 1;
      processed += 1;
      continue;
    }

    const claim = await admin
      .from("ai_jobs")
      .update({
        status: "in_progress",
        started_at: toIso(new Date())
      })
      .eq("id", job.id)
      .eq("status", "queued");

    if (claim.error || !(claim.data ?? []).length) {
      skipped += 1;
      continue;
    }

    processed += 1;
    const currentAttempt = Math.max(0, Number(job.attempts ?? 0));
    const maxAttempts = Math.max(1, Number(job.max_attempts ?? 3));

    try {
      const result = await regenerateSyllabusWithAiDetailed({
        examId: payload.exam_id,
        examSlug: payload.exam_slug,
        subject: payload.subject,
        sourceMeta: {
          generated_by: "ai_job_worker",
          job_id: job.id
        }
      });

      await admin
        .from("ai_jobs")
        .update({
          status: "completed",
          completed_at: toIso(new Date()),
          attempts: currentAttempt + 1,
          last_error: result.error ?? null,
          result_meta: {
            topics_count: Array.isArray(result.topics) ? result.topics.length : 0,
            provider: result.provider ?? null,
            model: result.model ?? null,
            completed_at: toIso(new Date())
          }
        })
        .eq("id", job.id);

      completed += 1;
    } catch (error: any) {
      const nextAttempt = currentAttempt + 1;
      const message = String(error?.message ?? "ai_job_failed").slice(0, 500);

      if (nextAttempt >= maxAttempts) {
        await admin
          .from("ai_jobs")
          .update({
            status: "failed",
            completed_at: toIso(new Date()),
            attempts: nextAttempt,
            last_error: message
          })
          .eq("id", job.id);
        failed += 1;
      } else {
        const nextRun = new Date(Date.now() + retryBackoffMs(nextAttempt));
        await admin
          .from("ai_jobs")
          .update({
            status: "queued",
            attempts: nextAttempt,
            run_after: toIso(nextRun),
            last_error: message
          })
          .eq("id", job.id);
        retried += 1;
      }
    }
  }

  return {
    ok: true,
    processed,
    completed,
    retried,
    failed,
    skipped
  };
}
