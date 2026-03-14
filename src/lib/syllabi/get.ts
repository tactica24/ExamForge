import "server-only";

import { createBackendServerClient } from "@/lib/backend/server";
import { generateJsonWithFallback } from "@/lib/ai/multi";
import { getFallbackTopics, getGenericTopicsForSubject, type Topic } from "@/lib/syllabi/fallback";

export type SyllabusTopic = Topic;
type SyllabusSource = "ai_auto" | "ai_admin" | "seed_fallback" | "generic_fallback" | "document_fallback";
export type SourceMeta = Record<string, unknown>;
export type SyllabusAiResult = {
  topics: SyllabusTopic[] | null;
  model: string | null;
  provider: string | null;
  error: string | null;
};

const FALLBACK_RETRY_WINDOW_MS = 6 * 60 * 60 * 1000;

async function persistTopics(args: {
  examId: string;
  subject: string;
  topics: SyllabusTopic[];
  source: SyllabusSource;
  sourceMeta?: SourceMeta;
}) {
  const backend = await createBackendServerClient();
  await backend
    .from("syllabi")
    .upsert(
      {
        exam_id: args.examId,
        subject: args.subject,
        topics: args.topics as any,
        source_meta: {
          source: args.source,
          updated_at: new Date().toISOString(),
          ...(args.sourceMeta ?? {})
        },
        last_updated: new Date().toISOString()
      },
      { onConflict: "exam_id,subject" }
    )
    .then(() => {})
    .catch(() => {});
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isFallbackSource(source: string) {
  return source === "seed_fallback" || source === "generic_fallback" || source === "document_fallback";
}

function shouldRetryFallbackUpgrade(sourceMeta: Record<string, unknown>) {
  const attemptedAt = toIso(sourceMeta.ai_retry_attempted_at);
  if (!attemptedAt) return true;
  return Date.now() - new Date(attemptedAt).getTime() >= FALLBACK_RETRY_WINDOW_MS;
}

function normalizeSourceText(value: string | undefined) {
  const cleaned = String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 28000);
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function buildTopicsFromDocumentText(subject: string, sourceText: string): SyllabusTopic[] {
  const text = String(sourceText ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];

  const STOP = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "these",
    "those",
    "into",
    "over",
    "under",
    "about",
    "through",
    "during",
    "shall",
    "should",
    "will",
    "would",
    "must",
    "can",
    "could",
    "has",
    "have",
    "had",
    "are",
    "was",
    "were",
    "been",
    "being",
    "may",
    "might",
    "subject",
    "exam",
    "syllabus"
  ]);

  const sentences = text
    .split(/(?<=[\.\!\?\:\;])\s+/g)
    .map((line) => line.replace(/[^A-Za-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 24);

  const topics: SyllabusTopic[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    if (topics.length >= 12) break;
    const words = sentence
      .split(" ")
      .map((word) => word.toLowerCase())
      .filter((word) => word.length >= 3 && !STOP.has(word));
    if (words.length < 4) continue;

    const title = toTitleCase(words.slice(0, 6).join(" ")).slice(0, 120);
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);

    const subtopics: string[] = [];
    if (words.length > 6) subtopics.push(toTitleCase(words.slice(6, 10).join(" ")).slice(0, 120));
    if (words.length > 10) subtopics.push(toTitleCase(words.slice(10, 14).join(" ")).slice(0, 120));

    topics.push({
      title,
      path: title,
      subtopics: subtopics.filter((item) => item.length >= 2)
    });
  }

  if (topics.length >= 4) return topics;

  return getGenericTopicsForSubject(subject)
    .slice(0, 10)
    .map((topic) => ({
      title: topic.title,
      path: topic.path,
      subtopics: topic.subtopics ?? []
    }));
}

async function generateAiTopics(args: { examSlug: string; subject: string; sourceText?: string }): Promise<SyllabusAiResult> {
  const documentText = normalizeSourceText(args.sourceText);
  const system = [
    "You generate exam syllabus topic trees.",
    'Return valid JSON only in this format: {"topics":[{"title":"...","path":"...","subtopics":["...","..."]}]}',
    "Keep it concise, practical, and suitable for objective-question preparation.",
    "Create 8 to 12 topics with short subtopics.",
    documentText
      ? "When syllabus source text is provided, use it as the primary source and avoid inventing unrelated topics."
      : "When source text is not provided, infer likely exam coverage for the subject."
  ].join("\n");

  const response = await generateJsonWithFallback<any>({
    system,
    user: JSON.stringify({
      exam: args.examSlug.toUpperCase(),
      subject: args.subject,
      source_text: documentText ?? undefined
    }),
    temperature: 0.35,
    validate: (parsed) => {
      const raw = Array.isArray(parsed?.topics) ? parsed.topics : [];
      const topics: SyllabusTopic[] = raw
        .filter((item: any) => typeof item?.title === "string")
        .map((item: any) => ({
          title: String(item.title).slice(0, 120),
          path: String(item.path ?? item.title).slice(0, 120),
          subtopics: Array.isArray(item.subtopics)
            ? item.subtopics.map((sub: any) => String(sub).slice(0, 120)).slice(0, 10)
            : []
        }))
        .filter((item: SyllabusTopic) => item.title.length >= 2);

      return topics.length ? { topics } : null;
    }
  });

  return {
    topics: response.value?.topics ?? null,
    model: response.model,
    provider: response.provider,
    error: response.error
  };
}

export async function regenerateSyllabusWithAiDetailed(args: {
  examId: string;
  examSlug: string;
  subject: string;
  sourceText?: string;
  sourceMeta?: SourceMeta;
}): Promise<SyllabusAiResult> {
  const ai = await generateAiTopics({
    examSlug: args.examSlug,
    subject: args.subject,
    sourceText: args.sourceText
  });

  if (ai.topics?.length) {
    await persistTopics({
      examId: args.examId,
      subject: args.subject,
      topics: ai.topics,
      source: "ai_admin",
      sourceMeta: {
        model: ai.model ?? undefined,
        provider: ai.provider ?? undefined,
        generated_by: "admin_action",
        ...(args.sourceMeta ?? {})
      }
    });

    return ai;
  }

  if (args.sourceText) {
    const documentFallback = buildTopicsFromDocumentText(args.subject, args.sourceText);
    if (documentFallback.length) {
      await persistTopics({
        examId: args.examId,
        subject: args.subject,
        topics: documentFallback,
        source: "document_fallback",
        sourceMeta: {
          generated_by: "admin_action_fallback",
          ai_error: ai.error ?? "AI generation failed.",
          ...(args.sourceMeta ?? {})
        }
      });

      return {
        topics: documentFallback,
        model: ai.model,
        provider: ai.provider,
        error: ai.error
      };
    }
  }

  const seedFallback = getFallbackTopics(args.examSlug, args.subject);
  if (seedFallback?.length) {
    await persistTopics({
      examId: args.examId,
      subject: args.subject,
      topics: seedFallback,
      source: "seed_fallback",
      sourceMeta: {
        generated_by: "admin_action_fallback",
        ai_error: ai.error ?? "AI generation failed.",
        ...(args.sourceMeta ?? {})
      }
    });

    return {
      topics: seedFallback,
      model: ai.model,
      provider: ai.provider,
      error: ai.error
    };
  }

  const genericFallback = getGenericTopicsForSubject(args.subject);
  await persistTopics({
    examId: args.examId,
    subject: args.subject,
    topics: genericFallback,
    source: "generic_fallback",
    sourceMeta: {
      generated_by: "admin_action_fallback",
      ai_error: ai.error ?? "AI generation failed.",
      ...(args.sourceMeta ?? {})
    }
  });

  return {
    topics: genericFallback,
    model: ai.model,
    provider: ai.provider,
    error: ai.error
  };
}

export async function regenerateSyllabusWithAi(args: {
  examId: string;
  examSlug: string;
  subject: string;
  sourceText?: string;
}) {
  const ai = await regenerateSyllabusWithAiDetailed(args);
  if (!ai.topics?.length) return null;
  return ai.topics;
}

async function markFallbackAiRetry(args: {
  examId: string;
  subject: string;
  source: SyllabusSource;
  topics: SyllabusTopic[];
  reason: string;
}) {
  await persistTopics({
    examId: args.examId,
    subject: args.subject,
    source: args.source,
    topics: args.topics,
    sourceMeta: {
      ai_retry_attempted_at: new Date().toISOString(),
      ai_retry_error: args.reason
    }
  });
}

function sourceFromMeta(sourceMeta: Record<string, unknown>): string {
  const source = String(sourceMeta.source ?? "");
  if (
    source === "ai_auto" ||
    source === "ai_admin" ||
    source === "seed_fallback" ||
    source === "generic_fallback" ||
    source === "document_fallback"
  ) {
    return source;
  }
  return "manual";
}

export async function getTopicsForExamSubject(args: { examId: string; examSlug: string; subject: string }) {
  const backend = await createBackendServerClient();

  const { data } = await backend
    .from("syllabi")
    .select("topics,source_meta,last_updated")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .maybeSingle();

  if (data?.topics && Array.isArray(data.topics)) {
    const existingTopics =
      data.topics as unknown as Array<{ title: string; path: string; subtopics?: string[]; resources?: any[] }>;

    const sourceMeta = toObject(data.source_meta);
    const source = sourceFromMeta(sourceMeta);

    if (isFallbackSource(source) && shouldRetryFallbackUpgrade(sourceMeta)) {
      const ai = await generateAiTopics({ examSlug: args.examSlug, subject: args.subject });
      if (ai.topics?.length) {
        await persistTopics({
          examId: args.examId,
          subject: args.subject,
          topics: ai.topics,
          source: "ai_auto",
          sourceMeta: {
            model: ai.model ?? undefined,
            provider: ai.provider ?? undefined,
            upgraded_from: source
          }
        });
        return ai.topics;
      }

      await markFallbackAiRetry({
        examId: args.examId,
        subject: args.subject,
        source: source as SyllabusSource,
        topics: existingTopics as SyllabusTopic[],
        reason: ai.error ?? "AI generation failed."
      });
    }

    return existingTopics;
  }

  const ai = await generateAiTopics({ examSlug: args.examSlug, subject: args.subject });
  if (ai.topics?.length) {
    await persistTopics({
      examId: args.examId,
      subject: args.subject,
      topics: ai.topics,
      source: "ai_auto",
      sourceMeta: {
        model: ai.model ?? undefined,
        provider: ai.provider ?? undefined
      }
    });
    return ai.topics;
  }

  const fallback = getFallbackTopics(args.examSlug, args.subject);
  if (fallback) {
    await persistTopics({
      examId: args.examId,
      subject: args.subject,
      topics: fallback,
      source: "seed_fallback",
      sourceMeta: {
        ai_error: ai.error ?? "AI generation failed."
      }
    });
    return fallback;
  }

  const generic = getGenericTopicsForSubject(args.subject);
  await persistTopics({
    examId: args.examId,
    subject: args.subject,
    topics: generic,
    source: "generic_fallback",
    sourceMeta: {
      ai_error: ai.error ?? "AI generation failed."
    }
  });
  return generic;
}

