import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { createExtraQuizAction } from "@/app/(app)/quiz/extra/actions";
import { listActiveExams } from "@/lib/exams/list";
import { ExtraQuizConfig } from "@/components/quiz/extra-quiz-config";
import { hasActiveProAccess } from "@/lib/billing/access";
import Link from "next/link";

export default async function ExtraQuizPage(props: { searchParams: Promise<{ exam_id?: string; subject?: string }> }) {
  const sp = await props.searchParams;
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await firebase
    .from("profiles")
    .select("subscription_tier,pro_until")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!hasActiveProAccess(profile)) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Extra practice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your free access window has ended. Upgrade to keep generating new objective-question drills.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upgrade to continue creating new drills</CardTitle>
            <CardDescription>
              Your past results and reviews stay available, but new practice generation is now a premium feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/pricing">See pricing & upgrade</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/progress">Open progress</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const exams = await listActiveExams();

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Extra practice</h1>
        <p className="mt-1 text-sm text-muted-foreground">Target weak areas with quick drills.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate extra objective questions</CardTitle>
          <CardDescription>
            Pick an exam, subject, and optional topic focus. Objective questions adapt to your AI language preference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={createExtraQuizAction}>
            <ExtraQuizConfig
              exams={exams.map((exam) => ({
                id: exam.id,
                slug: exam.slug,
                name: exam.name,
                subjects: Array.isArray(exam.subjects) ? (exam.subjects as string[]) : []
              }))}
              defaultExamId={sp.exam_id}
              defaultSubject={sp.subject}
            />
            <div className="mt-4">
              <SubmitButton type="submit" pendingText="Generating..." className="w-full sm:w-auto">
                Start objective questions
              </SubmitButton>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>
    </div>
  );
}
