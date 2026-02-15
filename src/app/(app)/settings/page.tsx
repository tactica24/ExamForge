import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listActiveExams } from "@/lib/exams/list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import {
  addExamSubjectAction,
  createParentLinkAction,
  updateNotificationPrefsAction,
  updateProfileAction
} from "@/app/(app)/settings/actions";
import { ReferralCard } from "@/components/referrals/referral-card";
import { ParentLinksCard } from "@/components/parent/parent-links-card";

function toSubjects(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, prefsRes, parentLinksRes, userSubjectsRes, exams] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("notification_prefs").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("parent_links")
      .select("token,label,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("user_exam_subjects")
      .select("exam_id,subject,is_active,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    listActiveExams()
  ]);

  const profile = profileRes.data;
  const prefs = prefsRes.data;
  const parentLinks = parentLinksRes.data ?? [];
  const userExamSubjects = userSubjectsRes.data ?? [];

  const channel = Array.isArray(prefs?.channels) ? String((prefs?.channels as any[])[0] ?? "in_app") : "in_app";

  const examNameById = new Map(exams.map((exam) => [exam.id, exam.name]));
  const allExamSubjectOptions = exams.flatMap((exam) =>
    toSubjects(exam.subjects).map((subject) => ({
      value: `${exam.id}::${subject}`,
      label: `${exam.name} - ${subject}`
    }))
  );

  const existingSelections = new Set(userExamSubjects.map((item) => `${item.exam_id}::${item.subject}`));
  const availableExamSubjectOptions = allExamSubjectOptions.filter((item) => !existingSelections.has(item.value));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile, subjects, and reminders.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Used for personalization and group matching.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={updateProfileAction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={profile?.name ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  defaultValue={profile?.display_name ?? ""}
                  placeholder="Shown on leaderboards"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" defaultValue={profile?.location ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" name="timezone" defaultValue={profile?.timezone ?? "Africa/Lagos"} required />
              </div>
              <div className="space-y-2">
                <Label>Learning style</Label>
                <NativeSelect name="learning_style" defaultValue={profile?.learning_style ?? "visual"}>
                  <option value="visual">Visual</option>
                  <option value="auditory">Auditory</option>
                  <option value="reading">Reading/Writing</option>
                  <option value="kinesthetic">Kinesthetic</option>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <NativeSelect name="level" defaultValue={profile?.level ?? "beginner"}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </NativeSelect>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Preferred explanation language (AI only)</Label>
                <NativeSelect
                  name="preferred_explanation_language"
                  defaultValue={profile?.preferred_explanation_language ?? "en"}
                >
                  <option value="en">English</option>
                  <option value="pidgin">Pidgin</option>
                  <option value="hausa">Hausa</option>
                  <option value="yoruba">Yoruba</option>
                  <option value="igbo">Igbo</option>
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  UI stays in English; this applies only to AI-generated explanations and tutor replies.
                </p>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <input
                  id="low_data_mode"
                  name="low_data_mode"
                  type="checkbox"
                  defaultChecked={Boolean(profile?.low_data_mode)}
                  className="h-4 w-4 accent-black"
                />
                <Label htmlFor="low_data_mode">Low-data mode</Label>
                <span className="text-xs text-muted-foreground">Reduces heavy effects and prefetching.</span>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <input
                  id="leaderboard_anonymous"
                  name="leaderboard_anonymous"
                  type="checkbox"
                  defaultChecked={Boolean(profile?.leaderboard_anonymous)}
                  className="h-4 w-4 accent-black"
                />
                <Label htmlFor="leaderboard_anonymous">Show me as anonymous on leaderboards</Label>
              </div>
            </div>
            <div className="mt-4">
              <SubmitButton type="submit" pendingText="Saving..." className="w-full sm:w-auto">
                Save profile
              </SubmitButton>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subjects</CardTitle>
          <CardDescription>Add exam subjects to personalize plans and quiz recommendations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {userExamSubjects.length ? (
              userExamSubjects.map((item) => (
                <Badge key={`${item.exam_id}-${item.subject}`} variant={item.is_active ? "secondary" : "outline"}>
                  {examNameById.get(item.exam_id) ?? "Exam"}: {item.subject}
                </Badge>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No subjects selected yet. Add one below.</div>
            )}
          </div>

          <AuthFormState action={addExamSubjectAction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="exam_subject">Add exam subject</Label>
                <NativeSelect
                  id="exam_subject"
                  name="exam_subject"
                  defaultValue={availableExamSubjectOptions[0]?.value ?? ""}
                  disabled={!availableExamSubjectOptions.length}
                  required
                >
                  {availableExamSubjectOptions.length ? null : <option value="">All available subjects already selected</option>}
                  {availableExamSubjectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="mt-4">
              <SubmitButton
                type="submit"
                pendingText="Adding..."
                className="w-full sm:w-auto"
                disabled={!availableExamSubjectOptions.length}
              >
                Add subject
              </SubmitButton>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminders</CardTitle>
          <CardDescription>
            Choose when to get nudges. WhatsApp/SMS/email require provider keys configured in env.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={updateNotificationPrefsAction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reminder_time">Time (24h)</Label>
                <Input id="reminder_time" name="reminder_time" defaultValue={prefs?.reminder_time ?? "19:00"} required />
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <NativeSelect name="channel" defaultValue={channel}>
                  <option value="in_app">In-app</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </NativeSelect>
              </div>
            </div>
            <div className="mt-4">
              <SubmitButton type="submit" pendingText="Saving..." className="w-full sm:w-auto">
                Save reminders
              </SubmitButton>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>

      <ReferralCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create parent link</CardTitle>
          <CardDescription>Generate a new read-only link.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={createParentLinkAction}>
            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input id="label" name="label" placeholder="Mum / Dad / Guardian" />
            </div>
            <div className="mt-4">
              <SubmitButton type="submit" pendingText="Creating..." className="w-full sm:w-auto">
                Create link
              </SubmitButton>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>

      <ParentLinksCard links={parentLinks as any} />
    </div>
  );
}
