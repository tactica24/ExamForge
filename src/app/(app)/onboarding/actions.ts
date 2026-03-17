"use server";

import { addDays, formatISO } from "date-fns";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";
import { generatePlanItemsFromTopics } from "@/lib/plans/generate";
import { ensureSeedExamExists } from "@/lib/seed/ensure";
import { claimReferralForUser } from "@/lib/referrals/claim";

const OnboardingSchema = z.object({
  exam_id: z.string().min(3),
  exam_slug: z.string().min(2),
  subjects: z.array(z.string().trim().min(2)).min(1).max(7)
});

async function ensurePlanForSubject(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  userId: string;
  examId: string;
  examSlug: string;
  subject: string;
}) {
  await args.firebase.from("user_exam_subjects").upsert(
    {
      user_id: args.userId,
      exam_id: args.examId,
      subject: args.subject,
      is_active: true
    },
    { onConflict: "user_id,exam_id,subject" }
  );

  const { data: existingPlan } = await args.firebase
    .from("user_plans")
    .select("*")
    .eq("user_id", args.userId)
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let plan = existingPlan;
  if (!plan) {
    const { data: createdPlan, error: planErr } = await args.firebase
      .from("user_plans")
      .insert({
        user_id: args.userId,
        exam_id: args.examId,
        subject: args.subject,
        mode: "solo",
        pace: "steady",
        start_date: formatISO(new Date(), { representation: "date" }),
        target_date: null
      })
      .select("*")
      .single();
    if (planErr) throw new Error(planErr.message);
    plan = createdPlan;
  }

  const { count: existingItemCount } = await args.firebase
    .from("plan_items")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", plan.id);

  if (existingItemCount && existingItemCount > 0) return;

  const topics = await getTopicsForExamSubject({
    examId: args.examId,
    examSlug: args.examSlug,
    subject: args.subject
  });

  const items = generatePlanItemsFromTopics({
    topics,
    pace: "steady",
    startDate: formatISO(new Date(), { representation: "date" }),
    targetDate: null
  });

  if (!items.length) return;

  const { error: itemsErr } = await args.firebase.from("plan_items").insert(
    items.map((item) => ({
      plan_id: plan.id,
      scheduled_for: item.scheduled_for,
      day_index: item.day_index,
      topic_path: item.topic_path,
      title: item.title,
      resource_links: item.resource_links,
      status: "todo"
    }))
  );
  if (itemsErr) throw new Error(itemsErr.message);
}

export async function completeOnboardingAction(_: unknown, formData: FormData) {
  const parsed = OnboardingSchema.safeParse({
    exam_id: String(formData.get("exam_id") ?? "").trim(),
    exam_slug: String(formData.get("exam_slug") ?? "").trim(),
    subjects: formData.getAll("subjects").map((value) => String(value).trim()).filter(Boolean)
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Select one exam and at least one subject to continue."
    };
  }

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "You must be logged in." };

  const { data: existingProfile } = await firebase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const accessProfile = existingProfile ?? {
    subscription_tier: "free",
    pro_until: addDays(new Date(), 3).toISOString()
  };
  const examInterestSlugs = Array.isArray((existingProfile as any)?.exam_interest_slugs)
    ? Array.from(
        new Set([...(existingProfile as any).exam_interest_slugs.map((item: any) => String(item)), parsed.data.exam_slug])
      )
    : [parsed.data.exam_slug];

  const { error: profileErr } = await firebase.from("profiles").upsert({
    user_id: user.id,
    email: user.email ?? null,
    phone: existingProfile?.phone ?? user.phone ?? null,
    name: existingProfile?.name ?? String((user.user_metadata as any)?.name ?? user.email ?? "Learner"),
    location: existingProfile?.location ?? null,
    timezone: existingProfile?.timezone ?? "Africa/Lagos",
    learning_style: existingProfile?.learning_style ?? "visual",
    level: existingProfile?.level ?? "beginner",
    subscription_tier: accessProfile.subscription_tier ?? "free",
    pro_until: accessProfile.pro_until ?? null,
    exam_interest_slugs: examInterestSlugs,
    country: (existingProfile as any)?.country ?? null,
    state: (existingProfile as any)?.state ?? null
  });
  if (profileErr) return { ok: false, message: profileErr.message };

  let examId = parsed.data.exam_id;
  if (examId.startsWith("fallback-")) {
    try {
      examId = await ensureSeedExamExists({ slug: parsed.data.exam_slug });
    } catch {
      return {
        ok: false,
        message:
          "Seed data requires Firebase admin credentials. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY then try again."
      };
    }
  }

  for (const subject of parsed.data.subjects) {
    try {
      await ensurePlanForSubject({
        firebase,
        userId: user.id,
        examId,
        examSlug: parsed.data.exam_slug,
        subject
      });
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Could not create your study plan right now."
      };
    }
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
