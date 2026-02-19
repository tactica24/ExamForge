import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  generateAllExamSyllabiAction,
  generateSubjectSyllabusAiAction,
  uploadSubjectSyllabusDocumentAction,
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
  const coveredSubjects = new Set((syllabi ?? []).map((item) => String(item.subject)));
  const coveragePercent = subjects.length ? Math.round((coveredSubjects.size / subjects.length) * 100) : 0;

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
        <Card className="lg:col-span-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-cyan-100/30">
          <CardHeader>
            <CardTitle className="text-base">Syllabus content pipeline</CardTitle>
            <CardDescription>
              Upload official syllabus files first, then let AI structure topic JSON for plans and objective questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">
                Coverage: {coveredSubjects.size}/{subjects.length || 0} subjects
              </Badge>
              <Badge variant="secondary">{coveragePercent}% complete</Badge>
              <Badge variant="secondary">Preferred source: uploaded documents</Badge>
            </div>

            <AuthFormState action={uploadSubjectSyllabusDocumentAction} encType="multipart/form-data">
              <input type="hidden" name="exam_id" value={examId} />
              <input type="hidden" name="exam_slug" value={exam.slug} />

              <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                <div className="space-y-2">
                  <Label htmlFor="upload_subject">Subject</Label>
                  <NativeSelect id="upload_subject" name="subject" defaultValue={firstSubject} required>
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

                <div className="space-y-2">
                  <Label htmlFor="syllabus_file">Syllabus file (PDF, TXT, or MD)</Label>
                  <Input id="syllabus_file" name="file" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" required />
                </div>
              </div>

              <SubmitButton type="submit" pendingText="Uploading and structuring..." className="w-full sm:w-auto">
                Upload and structure syllabus
              </SubmitButton>
            </AuthFormState>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Generate syllabus with AI</CardTitle>
            <CardDescription>
              Use this when no file is available. It generates topics directly from exam + subject and stores model metadata.
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
                const meta = entry?.source_meta && typeof entry.source_meta === "object" ? (entry.source_meta as any) : {};
                const source = String(meta.source ?? "manual");
                const model = meta.model ? String(meta.model) : null;
                const aiError = meta.ai_error ? String(meta.ai_error) : meta.ai_retry_error ? String(meta.ai_retry_error) : null;
                const documentUrl = meta.document_url ? String(meta.document_url) : null;
                const documentName = meta.document_name ? String(meta.document_name) : null;
                return (
                  <div key={entry.id} className="rounded-lg border bg-card px-3 py-2 text-sm">
                    <div className="font-medium">{entry.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      Source: {source}
                      {model ? ` | Model: ${model}` : ""}
                      {" | "}Updated {new Date(entry.last_updated).toLocaleDateString()}
                    </div>
                    {documentUrl ? (
                      <a className="mt-1 block text-[11px] text-primary underline underline-offset-4" href={documentUrl} target="_blank" rel="noreferrer">
                        Source document{documentName ? `: ${documentName}` : ""}
                      </a>
                    ) : null}
                    {aiError ? <div className="mt-1 text-[11px] text-amber-700">AI note: {aiError}</div> : null}
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
