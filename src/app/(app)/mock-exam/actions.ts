"use server";

import { addDays, formatISO } from "date-fns";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { createQuizWithQuestions } from "@/lib/quizzes/create-quiz";
import { hasActiveProAccess } from "@/lib/billing/access";
import { isPlanItemQuizCompleted } from "@/lib/plans/content";

const Schema = z.object({
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subject: z.string().min(2).max(120),
  question_count: z.coerce.number().int().min(10).max(100).default(40),
  duration_min: z.coerce.number().int().min(5).max(180).default(60),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
});

function toCreatedAtMs(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sortNewestFirst<T extends { created_at?: string | null }>(rows: T[] | null | undefined) {
  return [...(rows ?? [])].sort((left, right) => toCreatedAtMs(right.created_at) - toCreatedAtMs(left.created_at));
}

export async function startMockExamAction(_: unknown, formData: FormData) {
  const parsed = Schema.safeParse({
    exam_id: formData.get("exam_id"),
    exam_slug: formData.get("exam_slug"),
    subject: formData.get("subject"),
    question_count: formData.get("question_count") ?? 40,
    duration_min: formData.get("duration_min") ?? 60,
    difficulty: formData.get("difficulty") ?? "medium"
  });
  if (!parsed.success) return { ok: false, message: "Invalid mock exam settings." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: profile } = await firebase
    .from("profiles")
    .select("subscription_tier,pro_until,preferred_explanation_language")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!hasActiveProAccess(profile)) {
    return {
      ok: false,
      message: "Mock exam is a Pro feature. Upgrade from /pricing to continue."
    };
  }

  const { data: exam } = await firebase
    .from("exams")
    .select("name,slug,subjects")
    .eq("id", parsed.data.exam_id)
    .maybeSingle();
  if (!exam) {
    return {
      ok: false,
      message: "The selected exam could not be found."
    };
  }

  const { data: plans } = await firebase
    .from("user_plans")
    .select("id,created_at")
    .eq("user_id", user.id)
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject);
  const plan = sortNewestFirst(plans)[0] ?? null;
  if (!plan?.id) {
    return {
      ok: false,
      message: "Complete at least one topic in your plan before taking a mock exam."
    };
  }

  const end = formatISO(new Date(), { representation: "date" });
  const start = formatISO(addDays(new Date(), -6), { representation: "date" });
  const { data: recentItems } = await firebase
    .from("plan_items")
    .select("topic_path,title,status,resource_links,scheduled_for")
    .eq("plan_id", plan.id)
    .gte("scheduled_for", start)
    .lte("scheduled_for", end);

  const completedTopics = (recentItems ?? [])
    .filter((item: any) => isPlanItemQuizCompleted(item?.resource_links) || item?.status === "done")
    .map((item: any) => String(item?.topic_path ?? item?.title ?? "").trim())
    .filter(Boolean);

  const uniqueTopics = Array.from(new Set(completedTopics));
  if (!uniqueTopics.length) {
    return {
      ok: false,
      message: "Mock exams are generated from topics you completed this week. Finish a topic quiz first."
    };
  }

  let quizId: string;
  try {
    quizId = await createQuizWithQuestions({
      userId: user.id,
      examId: parsed.data.exam_id,
      examName: exam.name ?? "Exam",
      examSlug: exam.slug ?? parsed.data.exam_slug,
      subject: parsed.data.subject,
      topicPath: `Mock exam: ${parsed.data.subject}`,
      quizType: "mock",
      difficulty: parsed.data.difficulty,
      questionCount: parsed.data.question_count,
      preferredLanguage: profile?.preferred_explanation_language ?? "en",
      syllabusOverride: uniqueTopics,
      meta: {
        duration_sec: parsed.data.duration_min * 60,
        question_count: parsed.data.question_count,
        completed_topics: uniqueTopics
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the mock exam right now.";
    return {
      ok: false,
      message
    };
  }

  redirect(`/mock-exam/${quizId}`);
}
