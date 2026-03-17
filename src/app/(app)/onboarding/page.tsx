import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { listActiveExams } from "@/lib/exams/list";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";

export default async function OnboardingPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const existingPlan = await getActivePlanForUser(user.id);
  if (existingPlan) redirect("/dashboard");

  const exams = await listActiveExams();
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  const preferredExamSlugs = Array.isArray(metadata.exam_interests)
    ? metadata.exam_interests.map((item) => String(item)).filter(Boolean)
    : [];

  return (
    <OnboardingWizard
      exams={exams}
      preferredExamSlugs={preferredExamSlugs}
    />
  );
}
