import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TutorChat } from "@/components/tutor/tutor-chat";
import { listActiveExams } from "@/lib/exams/list";

export default async function TutorPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const exams = await listActiveExams();

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">AI Tutor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask questions and get step-by-step help.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tutor chat</CardTitle>
          <CardDescription>Best for concept explanations and quick drills.</CardDescription>
        </CardHeader>
        <CardContent>
          <TutorChat
            exams={exams.map((exam) => ({
              id: exam.id,
              slug: exam.slug,
              name: exam.name,
              subjects: Array.isArray(exam.subjects) ? (exam.subjects as string[]) : []
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
