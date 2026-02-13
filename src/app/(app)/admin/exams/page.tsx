import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { createExamAction } from "@/app/(app)/admin/exams/actions";
import { Button } from "@/components/ui/button";

export default async function AdminExamsPage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const supabase = createSupabaseServerClient();
  const { data: exams } = await supabase.from("exams").select("*").order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manage exams</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add new exams/countries without changing code.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">Back</Link>
        </Button>
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
                    {e.name} <span className="text-muted-foreground">· {e.country_code}</span>
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
            <CardDescription>Example: Ghana WASSCE (`country_code=GH`).</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthFormState action={createExamAction}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" name="slug" placeholder="wassce" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country_code">Country code</Label>
                  <Input id="country_code" name="country_code" placeholder="GH" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="WASSCE" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Short description…" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="subjects">Subjects (comma-separated)</Label>
                  <Input id="subjects" name="subjects" placeholder="Mathematics, English, Biology" required />
                </div>
              </div>
              <div className="mt-4">
                <SubmitButton type="submit" pendingText="Creating…" className="w-full sm:w-auto">
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

