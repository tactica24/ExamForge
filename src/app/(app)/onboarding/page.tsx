import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getUserAppState } from "@/lib/auth/flow";
import { listActiveExams } from "@/lib/exams/list";
import { createFirebaseServerClient } from "@/lib/firebase/server";

export default async function OnboardingPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const [{ profile, isAdmin, hasCompletedOnboarding }, exams] = await Promise.all([
    getUserAppState({
      firebase,
      user
    }),
    listActiveExams()
  ]);

  if (isAdmin) redirect("/admin");
  if (hasCompletedOnboarding) redirect("/dashboard");

  const preferredExamSlugs = Array.isArray((profile as any)?.exam_interest_slugs)
    ? (profile as any).exam_interest_slugs.map((value: unknown) => String(value)).filter(Boolean)
    : [];

  return <OnboardingWizard exams={exams} preferredExamSlugs={preferredExamSlugs} />;
}
