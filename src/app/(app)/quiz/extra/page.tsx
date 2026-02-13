import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { createExtraQuizAction } from "@/app/(app)/quiz/extra/actions";

export default async function ExtraQuizPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const weak =
    plan?.weak_areas && typeof plan.weak_areas === "object" && !Array.isArray(plan.weak_areas)
      ? Object.entries(plan.weak_areas as any)
          .map(([topic, v]) => ({ topic, score: Number((v as any)?.score ?? v ?? 0) }))
          .filter((x) => Number.isFinite(x.score))
          .sort((a, b) => a.score - b.score)
      : [];

  const topics = weak.length ? weak.slice(0, 12) : [{ topic: plan.subject, score: 0 }];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Extra practice</h1>
        <p className="mt-1 text-sm text-muted-foreground">Target weak areas with quick drills.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate an extra quiz</CardTitle>
          <CardDescription>
            Pick a topic. Questions and explanations adapt to your AI language preference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={createExtraQuizAction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Topic</Label>
                <NativeSelect name="topic_path" defaultValue={topics[0]?.topic}>
                  {topics.map((t) => (
                    <option key={t.topic} value={t.topic}>
                      {t.topic} ({Math.round(t.score)}%)
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
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
                Start quiz
              </SubmitButton>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>
    </div>
  );
}
