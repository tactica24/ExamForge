import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { updateNotificationPrefsAction, updateProfileAction } from "@/app/(app)/settings/actions";

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const { data: prefs } = await supabase.from("notification_prefs").select("*").eq("user_id", user.id).maybeSingle();

  const channel = Array.isArray(prefs?.channels) ? String((prefs?.channels as any[])[0] ?? "in_app") : "in_app";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile and reminders.</p>
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
            </div>
            <div className="mt-4">
              <SubmitButton type="submit" pendingText="Saving…" className="w-full sm:w-auto">
                Save profile
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
              <SubmitButton type="submit" pendingText="Saving…" className="w-full sm:w-auto">
                Save reminders
              </SubmitButton>
            </div>
          </AuthFormState>
        </CardContent>
      </Card>
    </div>
  );
}
