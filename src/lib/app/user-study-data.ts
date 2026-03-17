import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";

type FirebaseServerClient = Awaited<ReturnType<typeof createFirebaseServerClient>>;

type CreatedAtRow = {
  created_at?: string | null;
};

type ScheduledRow = CreatedAtRow & {
  scheduled_for?: string | null;
  day_index?: number | null;
};

function toMs(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function compareCreatedAtDesc<T extends CreatedAtRow>(left: T, right: T) {
  return toMs(right.created_at) - toMs(left.created_at);
}

function compareScheduledAsc<T extends ScheduledRow>(left: T, right: T) {
  const scheduled = String(left.scheduled_for ?? "").localeCompare(String(right.scheduled_for ?? ""));
  if (scheduled !== 0) return scheduled;

  const dayIndex = Number(left.day_index ?? 0) - Number(right.day_index ?? 0);
  if (dayIndex !== 0) return dayIndex;

  return toMs(left.created_at) - toMs(right.created_at);
}

function sortCreatedAtDesc<T extends CreatedAtRow>(rows: T[] | null | undefined) {
  return [...(rows ?? [])].sort(compareCreatedAtDesc);
}

function sortScheduledAsc<T extends ScheduledRow>(rows: T[] | null | undefined) {
  return [...(rows ?? [])].sort(compareScheduledAsc);
}

export async function listUserExamSubjects(args: {
  firebase: FirebaseServerClient;
  userId: string;
}) {
  const { data } = await args.firebase
    .from("user_exam_subjects")
    .select("exam_id,subject,is_active,created_at")
    .eq("user_id", args.userId);

  return sortCreatedAtDesc(data);
}

export async function listPlanItemsForPlan(args: {
  firebase: FirebaseServerClient;
  planId: string;
  columns?: string;
}) {
  const { data } = await args.firebase
    .from("plan_items")
    .select(args.columns ?? "*")
    .eq("plan_id", args.planId);

  return sortScheduledAsc(data);
}

export async function listPlanItemsForDate(args: {
  firebase: FirebaseServerClient;
  planId: string;
  scheduledFor: string;
  columns?: string;
}) {
  const items = await listPlanItemsForPlan(args);
  return items.filter((item) => String(item?.scheduled_for ?? "") === args.scheduledFor);
}

export async function listPlanItemsInWindow(args: {
  firebase: FirebaseServerClient;
  planId: string;
  start: string;
  end: string;
  columns?: string;
}) {
  const items = await listPlanItemsForPlan(args);
  return items.filter((item) => {
    const scheduledFor = String(item?.scheduled_for ?? "");
    return Boolean(scheduledFor) && scheduledFor >= args.start && scheduledFor <= args.end;
  });
}

export async function listRecentQuizResults(args: {
  firebase: FirebaseServerClient;
  userId: string;
  limit?: number;
  columns?: string;
}) {
  const { data } = await args.firebase
    .from("user_quiz_results")
    .select(args.columns ?? "score,total,created_at,quiz_id")
    .eq("user_id", args.userId);

  return sortCreatedAtDesc(data).slice(0, args.limit ?? 10);
}

export async function listRecentInAppNotifications(args: {
  firebase: FirebaseServerClient;
  userId: string;
  limit?: number;
  columns?: string;
}) {
  const { data } = await args.firebase
    .from("notifications")
    .select(args.columns ?? "id,message,status,channel,scheduled_for,sent_at,created_at")
    .eq("user_id", args.userId)
    .eq("channel", "in_app");

  return sortCreatedAtDesc(data).slice(0, args.limit ?? 5);
}

export async function listActiveParentLinks(args: {
  firebase: FirebaseServerClient;
  userId: string;
  limit?: number;
}) {
  const { data } = await args.firebase
    .from("parent_links")
    .select("token,label,created_at,revoked_at")
    .eq("user_id", args.userId)
    .eq("revoked_at", null);

  return sortCreatedAtDesc(data).slice(0, args.limit ?? 5);
}

export async function getLatestUserPlanSummary(args: {
  firebase: FirebaseServerClient;
  userId: string;
  columns?: string;
}) {
  const { data } = await args.firebase
    .from("user_plans")
    .select(args.columns ?? "pace,created_at")
    .eq("user_id", args.userId);

  return sortCreatedAtDesc(data)[0] ?? null;
}
