import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpenCheck, Layers3 } from "lucide-react";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createBackendServerClient } from "@/lib/backend/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { createExamAction } from "@/app/(app)/admin/exams/actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminExamsPage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const backend = await createBackendServerClient();
  const { data: exams } = await backend.from("exams").select("*").order("name", { ascending: true });
  const totalExams = exams?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,12,27,0.85)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
              <BookOpenCheck className="h-3.5 w-3.5" />
              Content operations
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Exam catalogue and syllabus control</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">Add new exams and route into syllabus management without changing code.</p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/admin">Back</Link>
          </Button>
        </div>
        <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
          <Layers3 className="h-4 w-4 text-cyan-300" />
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Known exams</div>
            <div className="text-2xl font-semibold">{totalExams}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing exams</CardTitle>
            <CardDescription>Click an exam to manage its syllabi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {exams?.length ? (
              exams.map((e) => (
                <Link
                  key={e.id}
                  href={`/admin/exams/${e.id}`}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="font-medium">
                    {e.name} <span className="text-muted-foreground">- {e.country_code}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{e.slug}</span>
                </Link>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No exams yet. Add one.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add an exam</CardTitle>
            <CardDescription>Example: WAEC (`slug=waec`, `country_code=NG`).</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthFormState action={createExamAction}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" name="slug" placeholder="waec" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country_code">Country code</Label>
                  <Input id="country_code" name="country_code" placeholder="NG" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="WAEC" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Short description..." />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="subjects">Subjects (comma/new line separated)</Label>
                  <Textarea
                    id="subjects"
                    name="subjects"
                    className="min-h-[120px]"
                    placeholder={"English Language\nMathematics\nBiology\nChemistry"}
                    required
                  />
                </div>
              </div>
              <div className="mt-4">
                <SubmitButton type="submit" pendingText="Creating..." className="w-full sm:w-auto">
                  Create exam
                </SubmitButton>
              </div>
            </AuthFormState>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

