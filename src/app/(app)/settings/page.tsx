import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
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
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { AddExamSubjectFields } from "@/components/settings/add-exam-subject-fields";
import { mergeNigerianAndExamSubjects, mergeUniqueSubjects } from "@/data/subjects";

function toSubjects(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export default async function SettingsPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, prefsRes, parentLinksRes, userSubjectsRes, exams] = await Promise.all([
    firebase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    firebase.from("notification_prefs").select("*").eq("user_id", user.id).maybeSingle(),
    firebase
      .from("parent_links")
      .select("token,label,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    firebase
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
  const prefsObj = (prefs as any) ?? {};
  const remindersFromPrefs = Array.isArray(prefsObj?.reminders) ? (prefsObj.reminders as any[]) : [];
  const reminderDefaults = [
    { time: String(prefs?.reminder_time ?? "19:00"), channel, destination: profile?.phone ?? profile?.email ?? "" },
    { time: "08:00", channel: "in_app", destination: profile?.phone ?? profile?.email ?? "" },
    { time: "20:00", channel: "in_app", destination: profile?.phone ?? profile?.email ?? "" }
  ];
  const reminderSlots = [0, 1, 2].map((idx) => {
    const data = remindersFromPrefs[idx] ?? {};
    const fallback = reminderDefaults[idx];
    return {
      time: String(data?.time ?? fallback.time ?? ""),
      channel: String(data?.channel ?? fallback.channel ?? "in_app"),
      destination: String(data?.destination ?? fallback.destination ?? "")
    };
  });

  const consentRecord =
    prefsObj?.consents && typeof prefsObj.consents === "object" ? (prefsObj.consents as Record<string, unknown>) : {};
  const whatsappOptIn = Boolean(consentRecord.whatsapp);
  const whatsappTemplate = ["coach", "countdown", "streak"].includes(String(prefsObj?.whatsapp_template ?? "").toLowerCase())
    ? String(prefsObj.whatsapp_template).toLowerCase()
    : "coach";

  const examNameById = new Map(exams.map((exam) => [exam.id, exam.name]));
  const examOptions = exams.map((exam) => ({
    id: exam.id,
    slug: exam.slug,
    name: exam.name,
    subjects: toSubjects(exam.subjects)
  }));
  const existingSelections = userExamSubjects.map((item) => ({ examId: item.exam_id, subject: item.subject }));
  const existingSet = new Set(existingSelections.map((item) => `${item.examId}::${item.subject}`));
  const hasMoreExamSubjects = examOptions.some((exam) => {
    const subjects =
      exam.slug === "waec" || exam.slug === "neco" || exam.slug === "jamb"
        ? mergeNigerianAndExamSubjects(exam.subjects)
        : mergeUniqueSubjects(exam.subjects);
    return subjects.some((subject) => !existingSet.has(`${exam.id}::${subject}`));
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile, subjects, and reminders.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Used for personalization and group matching.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <AvatarUploader
              name={profile?.display_name ?? profile?.name ?? user.email ?? "Learner"}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </div>
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="avatar_url">Avatar URL (optional)</Label>
                <Input id="avatar_url" name="avatar_url" defaultValue={profile?.avatar_url ?? ""} placeholder="https://..." />
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
          <CardDescription>Add exam subjects to personalize plans and objective question recommendations.</CardDescription>
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
            <AddExamSubjectFields exams={examOptions} existingSelections={existingSelections} />
            <div className="mt-4">
              <SubmitButton type="submit" pendingText="Adding..." className="w-full sm:w-auto" disabled={!hasMoreExamSubjects}>
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
            Add up to three reminders with time, channel, and destination (phone or email).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={updateNotificationPrefsAction}>
            <div className="grid gap-4">
              {reminderSlots.map((reminder, idx) => (
                <div key={idx} className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_1fr_1.2fr]">
                  <div className="space-y-2">
                    <Label htmlFor={`reminder_time_${idx + 1}`}>Time #{idx + 1} (24h)</Label>
                    <Input
                      id={`reminder_time_${idx + 1}`}
                      name={`reminder_time_${idx + 1}`}
                      defaultValue={reminder.time}
                      placeholder="19:00"
                      required={idx === 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <NativeSelect name={`reminder_channel_${idx + 1}`} defaultValue={reminder.channel}>
                      <option value="in_app">In-app</option>
                      <option value="sms">SMS</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`reminder_destination_${idx + 1}`}>Destination</Label>
                    <Input
                      id={`reminder_destination_${idx + 1}`}
                      name={`reminder_destination_${idx + 1}`}
                      defaultValue={reminder.destination}
                      placeholder="Phone or email"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border bg-card p-3 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  id="whatsapp_opt_in"
                  name="whatsapp_opt_in"
                  type="checkbox"
                  defaultChecked={whatsappOptIn}
                  className="h-4 w-4 accent-black"
                />
                <Label htmlFor="whatsapp_opt_in">I consent to WhatsApp reminders</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp_template">WhatsApp reminder style</Label>
                <NativeSelect id="whatsapp_template" name="whatsapp_template" defaultValue={whatsappTemplate}>
                  <option value="coach">Coach style</option>
                  <option value="countdown">Exam countdown</option>
                  <option value="streak">Streak motivation</option>
                </NativeSelect>
              </div>
              <p className="text-xs text-muted-foreground">
                Use E.164 format for WhatsApp destinations (example: +2348012345678) and enable consent before delivery.
              </p>
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
