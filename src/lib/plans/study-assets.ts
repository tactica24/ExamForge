import "server-only";

import { generatePlanLesson } from "@/lib/plans/lesson";
import {
  getPlanItemLessonAssets,
  normalizePlanLesson,
  type PlanAudioLesson,
  type PlanLesson,
  type PlanLessonAssets,
  type PlanSlideDeck,
  type PlanStudyFormat
} from "@/lib/plans/content";
import type { createFirebaseServerClient } from "@/lib/firebase/server";

type FirebaseServerClient = Awaited<ReturnType<typeof createFirebaseServerClient>>;

const STUDY_ASSET_CACHE_TABLE = "study_assets_cache";

type SharedStudyAsset = {
  cacheKey: string;
  lesson: PlanLesson | null;
  assets: PlanLessonAssets;
  createdAt: string | null;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeKeyPart(value: unknown) {
  return cleanText(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function splitSentences(text: string, maxItems: number) {
  const chunks = String(text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((line) => cleanText(line, 220))
    .filter(Boolean);

  if (chunks.length) return chunks.slice(0, maxItems);

  const fallback = cleanText(text, 220);
  return fallback ? [fallback] : [];
}

function asLessonAssets(value: unknown): PlanLessonAssets {
  return getPlanItemLessonAssets({ assets: value });
}

function makeAudioNarration(lesson: PlanLesson): PlanAudioLesson {
  const blocks: string[] = [];
  if (lesson.overview) blocks.push(lesson.overview);

  for (const section of lesson.breakdown.slice(0, 6)) {
    blocks.push(`${section.heading}. ${section.explanation}`);
  }

  for (const example of lesson.examples.slice(0, 2)) {
    blocks.push(`Example question: ${example.question}`);
    blocks.push(`Walkthrough: ${example.walkthrough}`);
    blocks.push(`Answer focus: ${example.answer}`);
  }

  if (lesson.recap.length) {
    blocks.push(`Recap: ${lesson.recap.join(". ")}`);
  }

  return {
    narration: cleanText(blocks.join(" "), 9000),
    generated_at: new Date().toISOString(),
    source: "derived",
    provider: null,
    model: null
  };
}

function makeSlideDeck(args: { topicTitle: string; subject: string; lesson: PlanLesson }): PlanSlideDeck {
  const { lesson } = args;
  const overviewPoints = splitSentences(lesson.overview, 4);

  const slideTwo = lesson.breakdown.slice(0, 2);
  const slideThree = lesson.breakdown.slice(2, 6);
  const exampleOne = lesson.examples[0];
  const exampleTwo = lesson.examples[1];

  const slides = [
    {
      slide_number: 1,
      title: `${args.topicTitle} (${args.subject})`,
      content: overviewPoints.length ? overviewPoints : ["Study this topic with an exam-first mindset."],
      visual_suggestions: "Title card, exam icon, simple progress timeline",
      narration: cleanText(lesson.overview, 800)
    },
    {
      slide_number: 2,
      title: "Core concepts",
      content: slideTwo.map((section) => `${section.heading}: ${section.explanation}`).slice(0, 4),
      visual_suggestions: "Bullet list with icon markers",
      narration: cleanText(
        slideTwo.map((section) => `${section.heading}. ${section.explanation}`).join(" "),
        900
      )
    },
    {
      slide_number: 3,
      title: "How this appears in exams",
      content: slideThree.map((section) => `${section.heading}: ${section.explanation}`).slice(0, 4),
      visual_suggestions: "Question-paper mockup and highlight strips",
      narration: cleanText(
        slideThree.map((section) => `${section.heading}. ${section.explanation}`).join(" "),
        900
      )
    },
    {
      slide_number: 4,
      title: "Worked example 1",
      content: exampleOne
        ? [`Question: ${exampleOne.question}`, `Walkthrough: ${exampleOne.walkthrough}`, `Answer: ${exampleOne.answer}`]
        : ["Use one worked example to connect rules to options."],
      visual_suggestions: "Step-by-step reveal animation with checkmarks",
      narration: exampleOne
        ? cleanText(`${exampleOne.question}. ${exampleOne.walkthrough}. Answer: ${exampleOne.answer}`, 900)
        : "Use one worked example to connect rules to options."
    },
    {
      slide_number: 5,
      title: "Worked example 2 + traps",
      content: [
        ...(exampleTwo
          ? [`Question: ${exampleTwo.question}`, `Walkthrough: ${exampleTwo.walkthrough}`, `Answer: ${exampleTwo.answer}`]
          : []),
        ...lesson.common_mistakes.slice(0, 2).map((point) => `Avoid: ${point}`)
      ].slice(0, 4),
      visual_suggestions: "Split layout: example on left, mistakes on right",
      narration: cleanText(
        [
          exampleTwo ? `${exampleTwo.question}. ${exampleTwo.walkthrough}. Answer: ${exampleTwo.answer}` : "",
          lesson.common_mistakes.slice(0, 2).join(". ")
        ]
          .filter(Boolean)
          .join(" "),
        900
      )
    },
    {
      slide_number: 6,
      title: "Recap and action plan",
      content: lesson.recap.slice(0, 5),
      visual_suggestions: "Checklist with timeline icons",
      narration: cleanText(lesson.recap.join(". "), 900)
    }
  ]
    .map((slide) => ({
      ...slide,
      content: slide.content.map((entry) => cleanText(entry, 260)).filter(Boolean).slice(0, 5)
    }))
    .filter((slide) => slide.content.length);

  return {
    slides,
    generated_at: new Date().toISOString(),
    source: "derived",
    provider: null,
    model: null
  };
}

export function buildStudyAssetCacheKey(args: {
  examId: string;
  subject: string;
  topicPath: string;
  topicTitle: string;
  preferredLanguage: string | null | undefined;
}) {
  const topicKey = normalizeKeyPart(args.topicPath) || normalizeKeyPart(args.topicTitle) || "topic";
  return [
    normalizeKeyPart(args.examId),
    normalizeKeyPart(args.subject),
    topicKey,
    normalizeKeyPart(args.preferredLanguage || "en")
  ]
    .filter(Boolean)
    .join("|");
}

async function getSharedStudyAsset(args: {
  firebase: FirebaseServerClient;
  cacheKey: string;
}): Promise<SharedStudyAsset | null> {
  const { data } = await args.firebase
    .from(STUDY_ASSET_CACHE_TABLE)
    .select("cache_key,lesson,assets,created_at")
    .eq("cache_key", args.cacheKey)
    .limit(1)
    .maybeSingle();

  if (!data?.cache_key) return null;

  return {
    cacheKey: String(data.cache_key),
    lesson: normalizePlanLesson(data.lesson),
    assets: asLessonAssets(data.assets),
    createdAt: cleanText(data.created_at, 40) || null
  };
}

async function upsertSharedStudyAsset(args: {
  firebase: FirebaseServerClient;
  cacheKey: string;
  examId: string;
  subject: string;
  topicPath: string;
  topicTitle: string;
  preferredLanguage: string;
  lesson: PlanLesson;
  assets: PlanLessonAssets;
}) {
  await args.firebase.from(STUDY_ASSET_CACHE_TABLE).upsert(
    {
      cache_key: args.cacheKey,
      exam_id: args.examId,
      subject: args.subject,
      topic_path: args.topicPath,
      topic_title: args.topicTitle,
      topic_key: normalizeKeyPart(args.topicPath) || normalizeKeyPart(args.topicTitle) || "topic",
      preferred_language: args.preferredLanguage,
      lesson: args.lesson,
      assets: {
        selected_format: null,
        audio: args.assets.audio,
        slides: args.assets.slides
      },
      updated_at: new Date().toISOString()
    },
    { onConflict: "cache_key" }
  );
}

function mergeLessonAssets(base: PlanLessonAssets, incoming: PlanLessonAssets): PlanLessonAssets {
  return {
    selected_format: base.selected_format ?? incoming.selected_format,
    audio: base.audio ?? incoming.audio,
    slides: base.slides ?? incoming.slides
  };
}

export async function ensureStudyAssetsForPlanTopic(args: {
  firebase: FirebaseServerClient;
  examId: string;
  examName: string;
  subject: string;
  topicPath: string;
  topicTitle: string;
  preferredLanguage?: string | null;
  requestedFormat: PlanStudyFormat;
  existingLesson: PlanLesson | null;
  existingAssets: PlanLessonAssets;
  subtopics?: string[];
}) {
  const preferredLanguage = cleanText(args.preferredLanguage || "en", 40).toLowerCase() || "en";
  const cacheKey = buildStudyAssetCacheKey({
    examId: args.examId,
    subject: args.subject,
    topicPath: args.topicPath,
    topicTitle: args.topicTitle,
    preferredLanguage
  });

  const shared = await getSharedStudyAsset({ firebase: args.firebase, cacheKey });
  let lesson = args.existingLesson ?? shared?.lesson ?? null;
  let assets = mergeLessonAssets(args.existingAssets, shared?.assets ?? asLessonAssets(null));
  let shouldPersistShared = false;

  if (!lesson) {
    lesson = await generatePlanLesson({
      examName: args.examName,
      subject: args.subject,
      topicPath: args.topicPath,
      topicTitle: args.topicTitle,
      subtopics: args.subtopics,
      preferredLanguage
    });
    shouldPersistShared = true;
  }

  if (args.requestedFormat === "audio" && !assets.audio) {
    assets = {
      ...assets,
      audio: makeAudioNarration(lesson)
    };
    shouldPersistShared = true;
  }

  if (args.requestedFormat === "slides" && !assets.slides) {
    assets = {
      ...assets,
      slides: makeSlideDeck({
        topicTitle: args.topicTitle || args.topicPath,
        subject: args.subject,
        lesson
      })
    };
    shouldPersistShared = true;
  }

  assets = {
    ...assets,
    selected_format: args.requestedFormat
  };

  if (shouldPersistShared) {
    await upsertSharedStudyAsset({
      firebase: args.firebase,
      cacheKey,
      examId: args.examId,
      subject: args.subject,
      topicPath: args.topicPath,
      topicTitle: args.topicTitle,
      preferredLanguage,
      lesson,
      assets
    });
  }

  return {
    cacheKey,
    lesson,
    assets
  };
}
