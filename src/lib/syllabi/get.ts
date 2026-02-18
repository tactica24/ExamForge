import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { getFallbackTopics, getGenericTopicsForSubject, type Topic } from "@/lib/syllabi/fallback";

export type SyllabusTopic = Topic;
type SyllabusSource = "ai_auto" | "ai_admin" | "seed_fallback" | "generic_fallback";
type SourceMeta = Record<string, unknown>;

const AI_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano"] as const;
const FALLBACK_RETRY_WINDOW_MS = 6 * 60 * 60 * 1000;

async function persistTopics(args: {
  examId: string;
  subject: string;
  topics: SyllabusTopic[];
  source: SyllabusSource;
  sourceMeta?: SourceMeta;
}) {
  const firebase = await createFirebaseServerClient();
  await firebase
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

function trimErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown_error");
  return message.slice(0, 240);
}

function isFallbackSource(source: string) {
  return source === "seed_fallback" || source === "generic_fallback";
}

function shouldRetryFallbackUpgrade(sourceMeta: Record<string, unknown>) {
  const attemptedAt = toIso(sourceMeta.ai_retry_attempted_at);
  if (!attemptedAt) return true;
  return Date.now() - new Date(attemptedAt).getTime() >= FALLBACK_RETRY_WINDOW_MS;
}

function parseJsonObject(text: string): any | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function generateAiTopics(args: { examSlug: string; subject: string }) {
  const client = getOpenAIClient();
  if (!client) {
    return { topics: null as SyllabusTopic[] | null, model: null as string | null, error: "OpenAI client unavailable." };
  }

  let lastError = "No AI model returned valid topics.";

  for (const model of AI_MODELS) {
    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You generate exam syllabus topic trees.",
              "Return valid JSON only in this format: {\"topics\":[{\"title\":\"...\",\"path\":\"...\",\"subtopics\":[\"...\",\"...\"]}]}",
              "Keep it concise, practical, and suitable for objective-question preparation.",
              "Create 8 to 12 topics with short subtopics."
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify({
              exam: args.examSlug.toUpperCase(),
              subject: args.subject
            })
          }
        ]
      });

      const text = completion.choices[0]?.message?.content ?? "";
      const parsed = parseJsonObject(text);
      const raw = Array.isArray(parsed?.topics) ? parsed.topics : [];

      const topics: SyllabusTopic[] = raw
        .filter((item: any) => typeof item?.title === "string")
        .map((item: any) => ({
          title: String(item.title).slice(0, 120),
          path: String(item.path ?? item.title).slice(0, 120),
          subtopics: Array.isArray(item.subtopics)
            ? item.subtopics.map((sub: any) => String(sub).slice(0, 120)).slice(0, 8)
            : []
        }))
        .filter((item: SyllabusTopic) => item.title.length >= 2);

      if (topics.length) {
        return { topics, model, error: null as string | null };
      }

      lastError = `Model ${model} returned invalid syllabus JSON.`;
    } catch (error) {
      lastError = `Model ${model} failed: ${trimErrorMessage(error)}`;
    }
  }

  return { topics: null as SyllabusTopic[] | null, model: null as string | null, error: lastError };
}

export async function regenerateSyllabusWithAi(args: { examId: string; examSlug: string; subject: string }) {
  const ai = await generateAiTopics({ examSlug: args.examSlug, subject: args.subject });
  if (!ai.topics?.length) return null;

  await persistTopics({
    examId: args.examId,
    subject: args.subject,
    topics: ai.topics,
    source: "ai_admin",
    sourceMeta: {
      model: ai.model ?? undefined,
      generated_by: "admin_action"
    }
  });

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
  if (source === "ai_auto" || source === "ai_admin" || source === "seed_fallback" || source === "generic_fallback") {
    return source;
  }
  return "manual";
}

export async function getTopicsForExamSubject(args: { examId: string; examSlug: string; subject: string }) {
  const firebase = await createFirebaseServerClient();

  const { data } = await firebase
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
        model: ai.model ?? undefined
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
