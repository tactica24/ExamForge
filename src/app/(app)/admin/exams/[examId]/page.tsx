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
import { Textarea } from "@/components/ui/textarea";
import { upsertSyllabusAction } from "@/app/(app)/admin/exams/[examId]/actions";

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

  const subjects = Array.isArray(exam.subjects) ? (exam.subjects as any[]).map(String) : [];
  const firstSubject = subjects[0] ?? "Subject";
  const existing = syllabi?.find((s) => s.subject === firstSubject);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{exam.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {exam.country_code} · {exam.slug}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/exams">Back to exams</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Syllabi</CardTitle>
            <CardDescription>Subjects with stored topic JSON.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {syllabi?.length ? (
              syllabi.map((s) => (
                <div key={s.id} className="rounded-lg border bg-card px-3 py-2 text-sm">
                  <div className="font-medium">{s.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    Updated {new Date(s.last_updated).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No syllabi yet. Use the editor to add the first one.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit syllabus</CardTitle>
            <CardDescription>
              Paste a JSON array of topics:{" "}
              <code className="font-mono">[{'{ "title": "...", "path": "...", "subtopics": [...] }'}]</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthFormState action={upsertSyllabusAction}>
              <input type="hidden" name="exam_id" value={examId} />
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" defaultValue={firstSubject} />
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
                <SubmitButton type="submit" pendingText="Saving…" className="w-full sm:w-auto">
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

