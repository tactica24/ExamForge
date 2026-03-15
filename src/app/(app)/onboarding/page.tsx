import { redirect } from "next/navigation";
import { isUserAdmin } from "@/lib/auth/admin";
import { createBackendServerClient } from "@/lib/backend/server";
import { listActiveExams } from "@/lib/exams/list";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) redirect("/login");

  if (await isUserAdmin(backend, user)) redirect("/admin");

  const { data: existingPlan } = await backend
    .from("user_plans")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingPlan?.id) redirect("/dashboard");

  const exams = await listActiveExams();
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  const preferredExamSlugs = Array.isArray(metadata.exam_interests)
    ? metadata.exam_interests.map((item) => String(item)).filter(Boolean)
    : [];

  const initialName = typeof metadata.first_name === "string" && metadata.first_name.trim().length > 0
    ? metadata.first_name
    : typeof metadata.name === "string"
      ? metadata.name
      : "";

  const initialPhone = typeof metadata.phone === "string"
    ? metadata.phone
    : typeof user.phone === "string"
      ? user.phone
      : "";

  const initialLocation = typeof metadata.location === "string" ? metadata.location : "";

  return (
    <OnboardingWizard
      exams={exams}
      preferredExamSlugs={preferredExamSlugs}
      initialName={initialName}
      initialPhone={initialPhone}
      initialLocation={initialLocation}
    />
  );
}

