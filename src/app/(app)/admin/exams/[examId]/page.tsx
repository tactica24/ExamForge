import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  generateAllExamSyllabiAction,
  generateSubjectSyllabusAiAction,
  upsertSyllabusAction
} from "@/app/(app)/admin/exams/[examId]/actions";

export const dynamic = "force-dynamic";

export default async function AdminExamDetailPage(props: { params: Promise<{ examId: string }> }) {
  const { examId } = await props.params;
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const firebase = await createFirebaseServerClient();
  const { data: exam } = await firebase.from("exams").select("*").eq("id", examId).maybeSingle();
  if (!exam) redirect("/admin/exams");

  const { data: syllabi } = await firebase.from("syllabi").select("*").eq("exam_id", examId).order("subject", { ascending: true });
  const subjects = Array.isArray(exam.subjects) ? (exam.subjects as any[]).map((subject) => String(subject).trim()).filter(Boolean) : [];
  const firstSubject = subjects[0] ?? "English Language";
  const existing = syllabi?.find((item) => item.subject === firstSubject);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{exam.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {exam.country_code} | {exam.slug}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/exams">Back to exams</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Generate syllabus with AI</CardTitle>
            <CardDescription>
              OpenAI is used first. If unavailable, the app stores fallback topics so study planning still works.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <AuthFormState action={generateSubjectSyllabusAiAction}>
              <input type="hidden" name="exam_id" value={examId} />
              <input type="hidden" name="exam_slug" value={exam.slug} />
              <div className="space-y-2">
                <Label htmlFor="ai_subject">Subject</Label>
                <NativeSelect id="ai_subject" name="subject" defaultValue={firstSubject} required>
                  {subjects.length ? (
                    subjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))
                  ) : (
                    <option value={firstSubject}>{firstSubject}</option>
                  )}
                </NativeSelect>
              </div>
              <SubmitButton type="submit" pendingText="Generating..." className="w-full sm:w-auto">
                Generate selected subject
              </SubmitButton>
            </AuthFormState>

            <AuthFormState action={generateAllExamSyllabiAction}>
              <input type="hidden" name="exam_id" value={examId} />
              <input type="hidden" name="exam_slug" value={exam.slug} />
              <p className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
                Generate and store topics for all subjects configured under this exam.
              </p>
              <SubmitButton type="submit" pendingText="Generating..." className="w-full sm:w-auto">
                Generate all subjects
              </SubmitButton>
            </AuthFormState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stored syllabi</CardTitle>
            <CardDescription>Subjects that already have topic JSON in storage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {syllabi?.length ? (
              syllabi.map((entry) => {
                const source =
                  entry?.source_meta && typeof entry.source_meta === "object"
                    ? String((entry.source_meta as any).source ?? "manual")
                    : "manual";
                return (
                  <div key={entry.id} className="rounded-lg border bg-card px-3 py-2 text-sm">
                    <div className="font-medium">{entry.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      Source: {source} | Updated {new Date(entry.last_updated).toLocaleDateString()}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">
                No syllabi yet. Use the AI buttons above or paste JSON below.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit syllabus JSON</CardTitle>
            <CardDescription>
              Paste a topic array:
              <code className="ml-1 font-mono">[{'{ "title": "...", "path": "...", "subtopics": [...] }'}]</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthFormState action={upsertSyllabusAction}>
              <input type="hidden" name="exam_id" value={examId} />
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" defaultValue={firstSubject} required />
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="topics_json">Topics JSON</Label>
                <Textarea
                  id="topics_json"
                  name="topics_json"
                  className="min-h-[240px] font-mono text-xs"
                  defaultValue={JSON.stringify(existing?.topics ?? [], null, 2)}
                  required
                />
              </div>
              <div className="mt-4">
                <SubmitButton type="submit" pendingText="Saving..." className="w-full sm:w-auto">
                  Save syllabus
                </SubmitButton>
              </div>
            </AuthFormState>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
