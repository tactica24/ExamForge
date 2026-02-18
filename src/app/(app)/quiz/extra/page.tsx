import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { createExtraQuizAction } from "@/app/(app)/quiz/extra/actions";
import { listActiveExams } from "@/lib/exams/list";
import { ExtraQuizConfig } from "@/components/quiz/extra-quiz-config";

export default async function ExtraQuizPage(props: { searchParams: Promise<{ exam_id?: string; subject?: string }> }) {
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
