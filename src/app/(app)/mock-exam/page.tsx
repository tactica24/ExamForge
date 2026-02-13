import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startMockExamAction } from "@/app/(app)/mock-exam/actions";

export default async function MockExamStartPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mock exam</h1>
        <p className="mt-1 text-sm text-muted-foreground">Timed CBT-style practice from your current plan.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configure</CardTitle>
          <CardDescription>Start a full timed quiz and practice real exam pressure.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={startMockExamAction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="question_count">Questions</Label>
                <Input id="question_count" name="question_count" type="number" min={10} max={100} defaultValue={40} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration_min">Duration (minutes)</Label>
                <Input id="duration_min" name="duration_min" type="number" min={5} max={180} defaultValue={60} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Difficulty</Label>
                <NativeSelect name="difficulty" defaultValue="medium">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </NativeSelect>
              </div>
            </div>
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
