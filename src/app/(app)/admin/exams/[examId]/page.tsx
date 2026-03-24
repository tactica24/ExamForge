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
import { ExamQuestionBankGenerator } from "@/components/admin/exam-question-bank-generator";
import {
  deleteExamAction,
  deleteSyllabusAction,
  generateAllExamSyllabiAction,
  generateSubjectSyllabusAiAction,
  removeExamSubjectAction,
  uploadSubjectSyllabusDocumentAction,
  upsertSyllabusAction
} from "@/app/(app)/admin/exams/[examId]/actions";

export const dynamic = "force-dynamic";

function normalizeTopics(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ title: string; path: string; subtopics?: string[] }>;
  return value as Array<{ title: string; path: string; subtopics?: string[] }>;
}

function normalizeQuestionBankRows(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<Record<string, any>>;
  return value as Array<Record<string, any>>;
}

function countValue(value: { count?: number | null } | null | undefined) {
  return Number(value?.count ?? 0);
}

export default async function AdminExamDetailPage(props: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { examId } = await props.params;
  const searchParams = await props.searchParams;

  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const firebase = await createFirebaseServerClient();
  const { data: exam } = await firebase.from("exams").select("*").eq("id", examId).maybeSingle();
  if (!exam) redirect("/admin/exams");

  const { data: syllabi } = await firebase
    .from("syllabi")
    .select("*")
    .eq("exam_id", examId)
    .order("subject", { ascending: true });

  const subjects = Array.isArray(exam.subjects)
    ? (exam.subjects as any[]).map((subject) => String(subject).trim()).filter(Boolean)
    : [];
  const firstSubject = subjects[0] ?? "English Language";
  const selectedSubject =
    searchParams.subject && subjects.includes(String(searchParams.subject))
      ? String(searchParams.subject)
      : firstSubject;

  const selectedEntry = (syllabi ?? []).find((item) => item.subject === selectedSubject) ?? null;
  const selectedTopics = normalizeTopics(selectedEntry?.topics);
  const coveredSubjects = new Set((syllabi ?? []).map((item) => String(item.subject)));
  const coveragePercent = subjects.length ? Math.round((coveredSubjects.size / subjects.length) * 100) : 0;

  const [
    { data: bankRuns },
    approvedCountResult,
    needsReviewCountResult,
    rejectedCountResult,
    { data: approvedPreviewRaw }
  ] = await Promise.all([
    firebase
      .from("question_bank_runs")
      .select("*")
      .eq("exam_id", examId)
      .eq("subject", selectedSubject)
      .order("created_at", { ascending: false })
      .limit(8),
    firebase
      .from("question_bank_entries")
      .select("id", { head: true, count: "exact" })
      .eq("exam_id", examId)
      .eq("subject", selectedSubject)
      .eq("review_status", "approved"),
    firebase
      .from("question_bank_entries")
      .select("id", { head: true, count: "exact" })
      .eq("exam_id", examId)
      .eq("subject", selectedSubject)
      .eq("review_status", "needs_review"),
    firebase
      .from("question_bank_entries")
      .select("id", { head: true, count: "exact" })
      .eq("exam_id", examId)
      .eq("subject", selectedSubject)
      .eq("review_status", "rejected"),
    firebase
      .from("question_bank_entries")
      .select("id,topic_path,focus_label,difficulty,quality_score,review_status,question,options,correct_index,updated_at")
      .eq("exam_id", examId)
      .eq("subject", selectedSubject)
      .eq("review_status", "approved")
      .limit(12)
  ]);

  const approvedBankEntries = normalizeQuestionBankRows(approvedPreviewRaw);
  const approvedBankCount = countValue(approvedCountResult);
  const needsReviewBankCount = countValue(needsReviewCountResult);
  const rejectedBankCount = countValue(rejectedCountResult);
  const bankTopicCoverage = new Set(approvedBankEntries.map((entry) => String(entry.topic_path ?? "").trim()).filter(Boolean)).size;
  const recentBankRuns = normalizeQuestionBankRows(bankRuns);
  const latestBankRun = recentBankRuns[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured subjects</CardTitle>
          <CardDescription>Click a subject to inspect, edit, or delete its stored syllabus.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {subjects.length ? (
            subjects.map((subject) => {
              const hasSyllabus = coveredSubjects.has(subject);
              const active = subject === selectedSubject;
              return (
                <Link
                  key={subject}
                  href={`/admin/exams/${examId}?subject=${encodeURIComponent(subject)}`}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {subject} {hasSyllabus ? "- ready" : "- missing"}
                </Link>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">No subjects configured for this exam.</div>
          )}
        </CardContent>
      </Card>

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
                  <NativeSelect id="upload_subject" name="subject" defaultValue={selectedSubject} required>
                    {subjects.length ? (
                      subjects.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))
                    ) : (
                      <option value={selectedSubject}>{selectedSubject}</option>
                    )}
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="syllabus_file">Syllabus file (PDF, TXT, or MD)</Label>
                  <Input
                    id="syllabus_file"
                    name="file"
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                    required
                  />
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
              Use this when no file is available. Single subject generates immediately. Generate all runs all missing subjects in one go.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <AuthFormState action={generateSubjectSyllabusAiAction}>
              <input type="hidden" name="exam_id" value={examId} />
              <input type="hidden" name="exam_slug" value={exam.slug} />
              <div className="space-y-2">
                <Label htmlFor="ai_subject">Subject</Label>
                <NativeSelect id="ai_subject" name="subject" defaultValue={selectedSubject} required>
                  {subjects.length ? (
                    subjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))
                  ) : (
                    <option value={selectedSubject}>{selectedSubject}</option>
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
                Generate syllabi for all configured subjects that are still missing. This can take a short while for large exams.
              </p>
              <SubmitButton type="submit" pendingText="Generating all..." className="w-full sm:w-auto">
                Generate all missing subjects
              </SubmitButton>
            </AuthFormState>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-primary/20 bg-gradient-to-br from-emerald-50 via-card to-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Question bank automation</CardTitle>
            <CardDescription>
              Generate the full bank exam by exam. Each run works through every configured subject, spreads questions across stored syllabus topics, and pushes each subject toward 200 stored questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Approved: {approvedBankCount}</Badge>
              <Badge variant="secondary">Needs review: {needsReviewBankCount}</Badge>
              <Badge variant="secondary">Rejected: {rejectedBankCount}</Badge>
              <Badge variant="secondary">Preview topics: {bankTopicCoverage}</Badge>
              <Badge variant="secondary">Runs: {recentBankRuns.length}</Badge>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <ExamQuestionBankGenerator examId={examId} examName={exam.name} subjects={subjects} />

              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div>
                  <div className="text-sm font-medium">Selected subject snapshot</div>
                  <div className="text-xs text-muted-foreground">
                    {latestBankRun
                      ? `Status: ${String(latestBankRun.status ?? "unknown")} | Requested: ${Number(latestBankRun.total_requested ?? 0)} | Approved: ${Number(latestBankRun.total_approved ?? 0)}`
                      : "No question-bank runs yet for this subject."}
                  </div>
                </div>

                {latestBankRun ? (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      Generated
                      <div className="text-lg font-semibold">{Number(latestBankRun.total_generated ?? 0)}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      Needs review
                      <div className="text-lg font-semibold">{Number(latestBankRun.total_needs_review ?? 0)}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      Rejected
                      <div className="text-lg font-semibold">{Number(latestBankRun.total_rejected ?? 0)}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      Last run
                      <div className="text-sm font-semibold">
                        {latestBankRun.created_at ? new Date(String(latestBankRun.created_at)).toLocaleString() : "Unknown"}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 text-sm font-medium">Recent runs</div>
                <div className="space-y-2">
                  {recentBankRuns.length ? (
                    recentBankRuns.map((run) => (
                      <div key={String(run.id)} className="rounded-lg border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{String(run.status ?? "unknown")}</span>
                          <span className="text-xs text-muted-foreground">
                            {run.created_at ? new Date(String(run.created_at)).toLocaleString() : "Unknown time"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Requested {Number(run.total_requested ?? 0)} | Generated {Number(run.total_generated ?? 0)} | Approved {Number(run.total_approved ?? 0)} | Review {Number(run.total_needs_review ?? 0)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No runs yet for this subject.</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 text-sm font-medium">Approved question samples</div>
                <div className="space-y-3">
                  {approvedBankEntries.length ? (
                    approvedBankEntries.slice(0, 4).map((entry) => (
                      <div key={String(entry.id)} className="rounded-lg border px-3 py-3 text-sm">
                        <div className="text-xs text-muted-foreground">
                          {String(entry.topic_path ?? selectedSubject)} | {String(entry.difficulty ?? "medium")} | score {Number(entry.quality_score ?? 0)}
                        </div>
                        <div className="mt-1 font-medium">{String(entry.question ?? "")}</div>
                        {Array.isArray(entry.options) ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {entry.options.slice(0, 4).map((option: unknown, index: number) => (
                              <div key={`${entry.id}-${index}`}>
                                {String.fromCharCode(65 + index)}. {String(option ?? "")}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No approved questions stored yet for this subject. Run the generator above to populate the bank.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stored syllabi</CardTitle>
            <CardDescription>Click View to inspect. Delete removes only that subject syllabus JSON.</CardDescription>
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
                const isActive = entry.subject === selectedSubject;

                return (
                  <div key={entry.id} className={`rounded-lg border bg-card px-3 py-2 text-sm ${isActive ? "border-primary/40" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{entry.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          Source: {source}
                          {model ? ` | Model: ${model}` : ""}
                          {" | "}Updated {new Date(entry.last_updated).toLocaleDateString()}
                        </div>
                        {documentUrl ? (
                          <a
                            className="mt-1 block text-[11px] text-primary underline underline-offset-4"
                            href={documentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source document{documentName ? `: ${documentName}` : ""}
                          </a>
                        ) : null}
                        {aiError ? <div className="mt-1 text-[11px] text-amber-700">AI note: {aiError}</div> : null}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button asChild size="sm" variant={isActive ? "default" : "secondary"}>
                          <Link href={`/admin/exams/${examId}?subject=${encodeURIComponent(entry.subject)}`}>View</Link>
                        </Button>
                        <AuthFormState action={deleteSyllabusAction}>
                          <input type="hidden" name="exam_id" value={examId} />
                          <input type="hidden" name="subject" value={entry.subject} />
                          <SubmitButton type="submit" pendingText="Deleting..." className="h-8 px-3 text-xs" variant="outline">
                            Delete
                          </SubmitButton>
                        </AuthFormState>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">
                No syllabi yet. Use the upload/AI buttons above or paste JSON below.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Syllabus preview</CardTitle>
            <CardDescription>
              Selected subject: <span className="font-medium">{selectedSubject}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedEntry ? (
              <>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  {selectedTopics.length ? (
                    <ul className="space-y-2">
                      {selectedTopics.slice(0, 12).map((topic, index) => (
                        <li key={`${topic.path}-${index}`}>
                          <div className="font-medium">{topic.title || topic.path}</div>
                          {Array.isArray(topic.subtopics) && topic.subtopics.length ? (
                            <div className="text-xs text-muted-foreground">Subtopics: {topic.subtopics.join(", ")}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted-foreground">No topic entries found in this syllabus JSON.</div>
                  )}
                </div>
                <Textarea className="min-h-[220px] font-mono text-xs" value={JSON.stringify(selectedEntry.topics ?? [], null, 2)} readOnly />
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No stored syllabus for this subject yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
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
                <Input id="subject" name="subject" defaultValue={selectedSubject} required />
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="topics_json">Topics JSON</Label>
                <Textarea
                  id="topics_json"
                  name="topics_json"
                  className="min-h-[240px] font-mono text-xs"
                  defaultValue={JSON.stringify(selectedEntry?.topics ?? [], null, 2)}
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

        <Card className="lg:col-span-2 border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Remove a subject or delete this exam if a configuration mistake was made.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <AuthFormState action={removeExamSubjectAction}>
              <input type="hidden" name="exam_id" value={examId} />
              <div className="space-y-2">
                <Label htmlFor="remove_subject">Remove subject from exam</Label>
                <NativeSelect id="remove_subject" name="subject" defaultValue={selectedSubject} required>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <SubmitButton type="submit" pendingText="Removing..." className="w-full sm:w-auto" variant="outline">
                Remove subject
              </SubmitButton>
            </AuthFormState>

            <AuthFormState action={deleteExamAction}>
              <input type="hidden" name="exam_id" value={examId} />
              <input type="hidden" name="exam_slug" value={exam.slug} />
              <div className="space-y-2">
                <Label htmlFor="confirm_slug">Type exam slug to confirm delete</Label>
                <Input id="confirm_slug" name="confirm_slug" placeholder={exam.slug} required />
              </div>
              <SubmitButton type="submit" pendingText="Deleting..." className="w-full sm:w-auto" variant="outline">
                Delete entire exam
              </SubmitButton>
            </AuthFormState>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
