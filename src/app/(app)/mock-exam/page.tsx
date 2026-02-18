import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { startMockExamAction } from "@/app/(app)/mock-exam/actions";
import { listActiveExams } from "@/lib/exams/list";
import { MockExamConfig } from "@/components/mock-exam/mock-exam-config";

export default async function MockExamStartPage(props: { searchParams: Promise<{ exam_id?: string; subject?: string }> }) {
  const sp = await props.searchParams;
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const exams = await listActiveExams();

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Mock exam</h1>
        <p className="mt-1 text-sm text-muted-foreground">Timed CBT-style practice from your current plan.</p>
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
