"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { createQuizWithQuestions } from "@/lib/quizzes/create-quiz";
import {
  getPlanItemLesson,
  getPlanItemLessonAssets,
  getPlanItemProgress,
  isPlanItemQuizCompleted,
  withPlanItemLesson,
  withPlanItemLessonAssets
} from "@/lib/plans/content";
import { ensureStudyAssetsForPlanTopic } from "@/lib/plans/study-assets";
import { findTopicSubtopics } from "@/lib/plans/topic-subtopics";
import type { Json } from "@/lib/firebase/database.types";
import { hasActiveProAccess } from "@/lib/billing/access";

const UpdateSchema = z.object({
  item_id: z.string().uuid(),
  status: z.enum(["todo", "done", "skipped"])
});

const StartTopicQuizSchema = z.object({
  item_id: z.string().uuid()
});

const GenerateStudyFormatSchema = z.object({
  item_id: z.string().uuid(),
  format: z.enum(["text", "audio", "slides", "video", "ppt"])
});

type OwnedPlanTopic = {
  item: {
    id: string;
    plan_id: string;
    title: string;
    topic_path: string;
    status: string;
    resource_links?: unknown;
  };
  plan: {
    id: string;
    exam_id: string;
    subject: string;
  };
};

async function getOwnedPlanTopic(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  itemId: string;
}): Promise<OwnedPlanTopic | null> {
  const { data: item } = await args.firebase
    .from("plan_items")
    .select("id,plan_id,title,topic_path,status,resource_links")
    .eq("id", args.itemId)
    .maybeSingle();
  if (!item) return null;

  const { data: plan } = await args.firebase
    .from("user_plans")
    .select("id,exam_id,subject")
    .eq("id", item.plan_id)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (!plan) return null;

  return { item, plan };
}

async function isPlanItemLocked(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  planId: string;
  itemId: string;
}) {
  const { data: items } = await args.firebase
    .from("plan_items")
    .select("id,scheduled_for,day_index,status,resource_links,created_at")
    .eq("plan_id", args.planId)
    .order("scheduled_for", { ascending: true })
    .order("day_index", { ascending: true })
    .order("created_at", { ascending: true });

  const ordered = items ?? [];
  const idx = ordered.findIndex((row: any) => String(row?.id ?? "") === args.itemId);
  if (idx <= 0) return { locked: false, firstIncompleteId: null };

  for (let i = 0; i < idx; i += 1) {
    const prev = ordered[i];
    const completed = isPlanItemQuizCompleted(prev?.resource_links) || prev?.status === "done";
    if (!completed) {
      return { locked: true, firstIncompleteId: String(prev?.id ?? "") || null };
    }
  }

  return { locked: false, firstIncompleteId: null };
}

export async function updatePlanItemStatusAction(_: unknown, formData: FormData) {
  const parsed = UpdateSchema.safeParse({
    item_id: formData.get("item_id"),
    status: formData.get("status")
  });
  if (!parsed.success) return { ok: false, message: "Invalid update." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const ownedTopic = await getOwnedPlanTopic({
    firebase,
    userId: user.id,
    itemId: parsed.data.item_id
  });
  if (!ownedTopic) return { ok: false, message: "Topic not found." };

  const lockState = await isPlanItemLocked({
    firebase,
    planId: ownedTopic.plan.id,
    itemId: ownedTopic.item.id
  });
  if (lockState.locked) {
    return { ok: false, message: "Complete the previous topic and quiz first." };
  }

  if (parsed.data.status === "done" && !isPlanItemQuizCompleted(ownedTopic.item.resource_links)) {
    return { ok: false, message: "Finish the topic quiz to mark this topic as done." };
  }

  const { error } = await firebase.from("plan_items").update({ status: parsed.data.status }).eq("id", parsed.data.item_id);
  if (error) return { ok: false, message: error.message };

  return { ok: true };
}

export async function createPlanTopicQuizAction(_: unknown, formData: FormData) {
  const parsed = StartTopicQuizSchema.safeParse({
    item_id: formData.get("item_id")
  });
  if (!parsed.success) return { ok: false, message: "Invalid topic." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: accessProfile } = await firebase
    .from("profiles")
    .select("subscription_tier,pro_until")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!hasActiveProAccess(accessProfile)) {
    redirect("/pricing");
  }

  const ownedTopic = await getOwnedPlanTopic({
    firebase,
    userId: user.id,
    itemId: parsed.data.item_id
  });
  if (!ownedTopic) return { ok: false, message: "Topic not found." };

  const lockState = await isPlanItemLocked({
    firebase,
    planId: ownedTopic.plan.id,
    itemId: ownedTopic.item.id
  });
  if (lockState.locked) {
    return {
      ok: false,
      message: "Complete the previous topic and quiz before taking this one."
    };
  }

  const [{ data: exam }, { data: profile }] = await Promise.all([
    firebase.from("exams").select("name,slug").eq("id", ownedTopic.plan.exam_id).maybeSingle(),
    firebase.from("profiles").select("preferred_explanation_language").eq("user_id", user.id).maybeSingle()
  ]);

  const progress = getPlanItemProgress(ownedTopic.item.resource_links);
  const attempts = progress.quiz.attempts + 1;

  let quizId: string;
  try {
    quizId = await createQuizWithQuestions({
      userId: user.id,
      examId: ownedTopic.plan.exam_id,
      examName: exam?.name ?? "Exam",
      examSlug: exam?.slug ?? undefined,
      subject: ownedTopic.plan.subject,
      topicPath: ownedTopic.item.title || ownedTopic.item.topic_path,
      quizType: "extra",
      difficulty: "medium",
      questionCount: 10,
      preferredLanguage: profile?.preferred_explanation_language ?? "en",
      meta: {
        source: "plan_topic_lesson",
        plan_id: ownedTopic.plan.id,
        plan_item_id: ownedTopic.item.id,
        plan_item_attempt: attempts
      }
    });
  } catch (_error: unknown) {
    return { ok: false, message: "Could not generate questions right now. Please try again." };
  }

  redirect(`/quiz/${quizId}`);
}

function normalizeRequestedFormat(value: string) {
  if (value === "audio") return "audio" as const;
  if (value === "slides" || value === "video" || value === "ppt") return "slides" as const;
  return "text" as const;
}

export async function generatePlanTopicStudyFormatAction(_: unknown, formData: FormData) {
  const parsed = GenerateStudyFormatSchema.safeParse({
    item_id: formData.get("item_id"),
    format: formData.get("format")
  });
  if (!parsed.success) return { ok: false, message: "Invalid study format request." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: accessProfile } = await firebase
    .from("profiles")
    .select("subscription_tier,pro_until")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!hasActiveProAccess(accessProfile)) {
    redirect("/pricing");
  }

  const ownedTopic = await getOwnedPlanTopic({
    firebase,
    userId: user.id,
    itemId: parsed.data.item_id
  });
  if (!ownedTopic) return { ok: false, message: "Topic not found." };

  const lockState = await isPlanItemLocked({
    firebase,
    planId: ownedTopic.plan.id,
    itemId: ownedTopic.item.id
  });
  if (lockState.locked) {
    return {
      ok: false,
      message: "Complete the previous topic and quiz before opening this study format."
    };
  }

  const requestedFormat = normalizeRequestedFormat(parsed.data.format);

  const [{ data: latestItem }, { data: exam }, { data: profile }, { data: syllabus }] = await Promise.all([
    firebase
      .from("plan_items")
      .select("resource_links,topic_path,title")
      .eq("id", ownedTopic.item.id)
      .maybeSingle(),
    firebase.from("exams").select("name").eq("id", ownedTopic.plan.exam_id).maybeSingle(),
    firebase.from("profiles").select("preferred_explanation_language").eq("user_id", user.id).maybeSingle(),
    firebase
      .from("syllabi")
      .select("topics")
      .eq("exam_id", ownedTopic.plan.exam_id)
      .eq("subject", ownedTopic.plan.subject)
      .maybeSingle()
  ]);

  const sourceLinks = latestItem?.resource_links ?? ownedTopic.item.resource_links;
  const lesson = getPlanItemLesson(sourceLinks);
  const assets = getPlanItemLessonAssets(sourceLinks);

  try {
    const ensured = await ensureStudyAssetsForPlanTopic({
      firebase,
      examId: ownedTopic.plan.exam_id,
      examName: exam?.name ?? "Exam",
      subject: ownedTopic.plan.subject,
      topicPath: latestItem?.topic_path ?? ownedTopic.item.topic_path,
      topicTitle: latestItem?.title ?? ownedTopic.item.title,
      preferredLanguage: profile?.preferred_explanation_language ?? "en",
      requestedFormat,
      existingLesson: lesson,
      existingAssets: assets,
      subtopics: findTopicSubtopics(
        syllabus?.topics,
        latestItem?.topic_path ?? ownedTopic.item.topic_path,
        latestItem?.title ?? ownedTopic.item.title
      )
    });

    const withLesson = withPlanItemLesson(sourceLinks, ensured.lesson);
    const nextLinks = withPlanItemLessonAssets(withLesson, ensured.assets);

    const { error } = await firebase
      .from("plan_items")
      .update({ resource_links: nextLinks as Json })
      .eq("id", ownedTopic.item.id);

    if (error) {
      return { ok: false, message: "Could not store generated study format right now." };
    }
  } catch (_error: unknown) {
    return {
      ok: false,
      message: "Could not generate this study format right now. Please try again."
    };
  }

  redirect(`/plan/${ownedTopic.item.id}?format=${requestedFormat}`);
}
