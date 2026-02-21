import { redirect } from "next/navigation";
import Link from "next/link";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { startMockExamAction } from "@/app/(app)/mock-exam/actions";
import { listActiveExams } from "@/lib/exams/list";
import { MockExamConfig } from "@/components/mock-exam/mock-exam-config";
import { hasActiveProAccess } from "@/lib/billing/access";

export default async function MockExamStartPage(props: { searchParams: Promise<{ exam_id?: string; subject?: string }> }) {
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
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Mock exam</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mock exam is available on Pro. Free users can continue with study plans, objective questions, and explanations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upgrade to unlock mock exams</CardTitle>
            <CardDescription>
              Pro gives you timed full-length mock exams plus deeper practice tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/pricing">See pricing & upgrade</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/plan">Continue with free plan</Link>
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
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Mock exam</h1>
        <p className="mt-1 text-sm text-muted-foreground">Timed CBT-style practice from your current plan. One mock per subject is allowed every 7 days.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configure</CardTitle>
          <CardDescription>Start a full timed objective-question session and practice real exam pressure.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={startMockExamAction}>
            <MockExamConfig
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
                Start mock exam
              </SubmitButton>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>
    </div>
  );
}
