"use server";

import { addDays } from "date-fns";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";
import { generatePlanItemsFromTopics } from "@/lib/plans/generate";
import { matchOrCreateGroup } from "@/lib/groups/match";
import { ensureSeedExamExists } from "@/lib/seed/ensure";
import { hasActiveProAccess } from "@/lib/billing/access";
import { claimReferralForUser } from "@/lib/referrals/claim";

const OnboardingSchema = z.object({
  name: z.string().min(2).max(60),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(24)
    .regex(/^\+?[0-9\s\-()]+$/)
    .optional(),
  country: z.string().min(2).max(80),
  state: z.string().trim().max(80).optional(),
  learning_style: z.string().min(2).max(30),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subject: z.string().min(2),
  mode: z.enum(["solo", "group"]),
  pace: z.enum(["steady", "intensive", "topics_3", "topics_4", "topics_5"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export async function completeOnboardingAction(_: unknown, formData: FormData) {
  const parsed = OnboardingSchema.safeParse({
    name: formData.get("name"),
    phone: (formData.get("phone") as string | null)?.trim() || undefined,
    country: formData.get("country"),
    state: (formData.get("state") as string | null)?.trim() || undefined,
    learning_style: formData.get("learning_style"),
    level: formData.get("level"),
    exam_id: formData.get("exam_id"),
    exam_slug: formData.get("exam_slug"),
    subject: formData.get("subject"),
    mode: formData.get("mode"),
    pace: formData.get("pace"),
    start_date: formData.get("start_date"),
    target_date: (formData.get("target_date") as string | null)?.trim() || undefined
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please complete all onboarding fields. If phone is provided, use a valid format."
    };
  }
  if (parsed.data.country === "Nigeria" && !parsed.data.state) {
    return { ok: false, message: "Select your state." };
  }
  if (parsed.data.target_date && parsed.data.target_date < parsed.data.start_date) {
    return { ok: false, message: "Target exam date must be on or after your start date." };
  }

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "You must be logged in." };

  let examId = parsed.data.exam_id;
  if (examId.startsWith("fallback-")) {
    try {
      examId = await ensureSeedExamExists({ slug: parsed.data.exam_slug });
    } catch (_e: any) {
      return {
        ok: false,
        message:
          "Seed data requires Firebase admin credentials. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY then try again."
      };
    }
  }

  const { data: existingProfile } = await firebase
    .from("profiles")
    .select("subscription_tier,pro_until")
    .eq("user_id", user.id)
    .maybeSingle();

  const accessProfile = existingProfile ?? {
    subscription_tier: "free",
    pro_until: addDays(new Date(), 3).toISOString()
  };

  if (!hasActiveProAccess(accessProfile)) {
    redirect("/pricing");
  }

  const location =
    parsed.data.country === "Nigeria" && parsed.data.state
      ? `${parsed.data.state}, Nigeria`
      : parsed.data.country;

  const { error: profileErr } = await firebase.from("profiles").upsert({
    user_id: user.id,
    email: user.email ?? null,
    phone: parsed.data.phone ?? user.phone ?? null,
    name: parsed.data.name,
    location,
    timezone: "Africa/Lagos",
    country: parsed.data.country,
    state: parsed.data.country === "Nigeria" ? parsed.data.state ?? null : null,
    learning_style: parsed.data.learning_style,
    level: parsed.data.level,
    subscription_tier: accessProfile.subscription_tier ?? "free",
    pro_until: accessProfile.pro_until ?? null
  });
  if (profileErr) return { ok: false, message: profileErr.message };

  await firebase.from("user_exam_subjects").upsert(
    {
      user_id: user.id,
      exam_id: examId,
      subject: parsed.data.subject,
      is_active: true
    },
    { onConflict: "user_id,exam_id,subject" }
  );

  const { data: existingPlan } = await firebase
    .from("user_plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .eq("subject", parsed.data.subject)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let plan = existingPlan;
  if (!plan) {
    const { data: createdPlan, error: planErr } = await firebase
      .from("user_plans")
      .insert({
        user_id: user.id,
        exam_id: examId,
        subject: parsed.data.subject,
        mode: parsed.data.mode,
        pace: parsed.data.pace,
        start_date: parsed.data.start_date,
        target_date: parsed.data.target_date ?? null
      })
      .select("*")
      .single();
    if (planErr) return { ok: false, message: planErr.message };
    plan = createdPlan;
  }

  const topics = await getTopicsForExamSubject({
    examId,
    examSlug: parsed.data.exam_slug,
    subject: parsed.data.subject
  });

  const items = generatePlanItemsFromTopics({
    topics,
    pace: parsed.data.pace,
    startDate: parsed.data.start_date,
    targetDate: parsed.data.target_date ?? null
  });

  const { count: existingItemCount } = await firebase
    .from("plan_items")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", plan.id);

  if (items.length && !(existingItemCount && existingItemCount > 0)) {
    const { error: itemsErr } = await firebase.from("plan_items").insert(
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
      timezone: "Africa/Lagos"
    });
  }

  const cookieStore = await cookies();
  const referralCode = cookieStore.get("ref_code")?.value ?? null;
  if (referralCode) {
    await claimReferralForUser({
      firebase,
      userId: user.id,
      code: referralCode,
      bonusDays: 3
    }).catch(() => {});
    cookieStore.set("ref_code", "", {
      path: "/",
      maxAge: 0
    });
  }

  redirect("/dashboard");
}
