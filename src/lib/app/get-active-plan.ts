import "server-only";

import { formatISO } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";
import { generatePlanItemsFromTopics } from "@/lib/plans/generate";

function toCreatedAtMs(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sortNewestFirst<T extends { created_at?: string | null }>(rows: T[] | null | undefined) {
  return [...(rows ?? [])].sort((left, right) => toCreatedAtMs(right.created_at) - toCreatedAtMs(left.created_at));
}

async function createFallbackPlanForLatestSelection(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
}) {
  const { data: selections } = await args.firebase
    .from("user_exam_subjects")
    .select("exam_id,subject,created_at")
    .eq("user_id", args.userId);

  const selection = sortNewestFirst(selections)?.[0] ?? null;

  if (!selection?.exam_id || !selection?.subject) return null;

  const { data: exam } = await args.firebase
    .from("exams")
    .select("id,slug")
    .eq("id", selection.exam_id)
    .maybeSingle();
  if (!exam?.id || !exam?.slug) return null;

  const startDate = formatISO(new Date(), { representation: "date" });

  const { data: createdPlan, error: planError } = await args.firebase
    .from("user_plans")
    .insert({
      user_id: args.userId,
      exam_id: selection.exam_id,
      subject: selection.subject,
      mode: "solo",
      pace: "steady",
      start_date: startDate,
      target_date: null
    })
    .select("*")
    .single();

  if (planError || !createdPlan) return null;

  const topics = await getTopicsForExamSubject({
    examId: selection.exam_id,
    examSlug: exam.slug,
    subject: selection.subject
  }).catch(() => []);

  const items = generatePlanItemsFromTopics({
    topics,
    pace: "steady",
    startDate,
    targetDate: null
  });

  if (items.length) {
    await args.firebase.from("plan_items").insert(
      items.map((item) => ({
        plan_id: createdPlan.id,
        scheduled_for: item.scheduled_for,
        day_index: item.day_index,
        topic_path: item.topic_path,
        title: item.title,
        resource_links: item.resource_links,
        status: "todo"
      }))
    );
  }

  return createdPlan;
}

export async function getActivePlanForUser(userId: string) {
  const firebase = await createFirebaseServerClient();
  const { data: plans } = await firebase
    .from("user_plans")
    .select("*")
    .eq("user_id", userId);

  const plan = sortNewestFirst(plans)?.[0] ?? null;

  if (plan) return plan;
  return createFallbackPlanForLatestSelection({ firebase, userId });
}
