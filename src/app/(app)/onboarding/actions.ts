"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";
import { generatePlanItemsFromTopics } from "@/lib/plans/generate";
import { matchOrCreateGroup } from "@/lib/groups/match";
import { ensureSeedExamExists } from "@/lib/seed/ensure";

const OnboardingSchema = z.object({
  name: z.string().min(2).max(60),
  location: z.string().min(2).max(80).optional(),
  timezone: z.string().min(2).max(60).default("Africa/Lagos"),
  learning_style: z.string().min(2).max(30),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subject: z.string().min(2),
  mode: z.enum(["solo", "group"]),
  pace: z.enum(["steady", "intensive"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function completeOnboardingAction(_: unknown, formData: FormData) {
  const parsed = OnboardingSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location") || undefined,
    timezone: formData.get("timezone") || "Africa/Lagos",
    learning_style: formData.get("learning_style"),
    level: formData.get("level"),
    exam_id: formData.get("exam_id"),
    exam_slug: formData.get("exam_slug"),
    subject: formData.get("subject"),
    mode: formData.get("mode"),
    pace: formData.get("pace"),
    start_date: formData.get("start_date")
  });

  if (!parsed.success) {
    return { ok: false, message: "Please complete all onboarding fields." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be logged in." };

  let examId = parsed.data.exam_id;
  if (examId.startsWith("fallback-")) {
    try {
      examId = await ensureSeedExamExists({ slug: parsed.data.exam_slug });
    } catch (e: any) {
      return {
        ok: false,
        message:
          "Seed data requires SUPABASE_SERVICE_ROLE_KEY. Add it to env (or run the Supabase migrations + seed) and try again."
      };
    }
  }

  const { error: profileErr } = await supabase.from("profiles").upsert({
    user_id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    name: parsed.data.name,
    location: parsed.data.location ?? null,
    timezone: parsed.data.timezone,
    learning_style: parsed.data.learning_style,
    level: parsed.data.level,
    subscription_tier: "free"
  });
  if (profileErr) return { ok: false, message: profileErr.message };

  await supabase.from("user_exam_subjects").upsert(
    {
      user_id: user.id,
      exam_id: examId,
      subject: parsed.data.subject,
      is_active: true
    },
    { onConflict: "user_id,exam_id,subject" }
  );

  const { data: plan, error: planErr } = await supabase
    .from("user_plans")
    .insert({
      user_id: user.id,
      exam_id: examId,
      subject: parsed.data.subject,
      mode: parsed.data.mode,
      pace: parsed.data.pace,
      start_date: parsed.data.start_date
    })
    .select("*")
    .single();
  if (planErr) return { ok: false, message: planErr.message };

  const topics = await getTopicsForExamSubject({
    examId,
    examSlug: parsed.data.exam_slug,
    subject: parsed.data.subject
  });

  const items = generatePlanItemsFromTopics({
    topics,
    pace: parsed.data.pace,
    startDate: parsed.data.start_date
  });

  if (items.length) {
    const { error: itemsErr } = await supabase.from("plan_items").insert(
      items.map((i) => ({
        plan_id: plan.id,
        scheduled_for: i.scheduled_for,
        day_index: i.day_index,
        topic_path: i.topic_path,
        title: i.title,
        resource_links: i.resource_links,
        status: "todo"
      }))
    );
    if (itemsErr) return { ok: false, message: itemsErr.message };
  }

  if (parsed.data.mode === "group") {
    await matchOrCreateGroup({
      userId: user.id,
      examId,
      subject: parsed.data.subject,
      pace: parsed.data.pace,
      level: parsed.data.level,
      timezone: parsed.data.timezone
    });
  }

  redirect("/dashboard");
}

