"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { createQuizWithQuestions } from "@/lib/quizzes/create-quiz";

const UpdateSchema = z.object({
  item_id: z.string().uuid(),
  status: z.enum(["todo", "done", "skipped"])
});

const StartTopicQuizSchema = z.object({
  item_id: z.string().uuid()
});

type OwnedPlanTopic = {
  item: {
    id: string;
    plan_id: string;
    title: string;
    topic_path: string;
    status: string;
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
    .select("id,plan_id,title,topic_path,status")
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

  const ownedTopic = await getOwnedPlanTopic({
    firebase,
    userId: user.id,
    itemId: parsed.data.item_id
  });
  if (!ownedTopic) return { ok: false, message: "Topic not found." };

  const [{ data: exam }, { data: profile }] = await Promise.all([
    firebase.from("exams").select("name,slug").eq("id", ownedTopic.plan.exam_id).maybeSingle(),
    firebase.from("profiles").select("preferred_explanation_language").eq("user_id", user.id).maybeSingle()
  ]);

  let quizId: string;
  try {
    quizId = await createQuizWithQuestions({
      userId: user.id,
      examId: ownedTopic.plan.exam_id,
      examName: exam?.name ?? "Exam",
      examSlug: exam?.slug ?? undefined,
      subject: ownedTopic.plan.subject,
      topicPath: ownedTopic.item.topic_path || ownedTopic.item.title,
      quizType: "extra",
      difficulty: "medium",
      questionCount: 10,
      preferredLanguage: profile?.preferred_explanation_language ?? "en",
      meta: {
        source: "plan_topic_lesson",
        plan_id: ownedTopic.plan.id,
        plan_item_id: ownedTopic.item.id
      }
    });
  } catch (_error: unknown) {
    return { ok: false, message: "Could not generate questions right now. Please try again." };
  }

  redirect(`/quiz/${quizId}`);
}
