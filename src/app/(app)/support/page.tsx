import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy, MessageSquareWarning, Settings } from "lucide-react";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createSupportRequestAction } from "@/app/(app)/support/actions";
import { createFirebaseServerClient } from "@/lib/firebase/server";

const TOPICS = [
  "Account access",
  "Billing and subscription",
  "Quiz or content issue",
  "Group study problem",
  "App bug or failure",
  "Other"
] as const;

export default async function SupportPage(props: { searchParams: Promise<{ created?: string }> }) {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await firebase
    .from("profiles")
    .select("display_name,name,email")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: requests } = await firebase
    .from("contact_requests")
    .select("id,topic,message,status,created_at,handled_at,resolution_notes,assigned_admin_email")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const searchParams = await props.searchParams;
  const created = searchParams.created === "1";
  const label = profile?.display_name ?? profile?.name ?? user.email ?? "User";
  const supportRequests = requests ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,12,27,0.85)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
              <LifeBuoy className="h-3.5 w-3.5" />
              Contact support
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Report a problem from inside the app</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">Send your issue directly to the support team.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80">
            Signed in as {label}
          </div>
        </div>
      </div>

      {created ? (
        <div className="rounded-xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Your support request has been submitted successfully.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <MessageSquareWarning className="h-3.5 w-3.5" />
              New request
            </div>
            <CardTitle>Tell us what went wrong</CardTitle>
            <CardDescription>Be specific so the admin team can resolve the issue faster.</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthFormState action={createSupportRequestAction}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Issue type</Label>
                  <NativeSelect id="topic" name="topic" defaultValue={TOPICS[0]}>
                    {TOPICS.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    className="min-h-[180px]"
                    placeholder="Describe what happened, what you expected, and any error message you saw."
                    required
                  />
                </div>
                <SubmitButton type="submit" pendingText="Sending..." className="w-full sm:w-auto">
                  Send to support
                </SubmitButton>
              </div>
            </AuthFormState>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" /> Back to settings
                </Link>
              </Button>
              <div className="rounded-xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                <Badge variant="outline">Tip</Badge>
                <div className="mt-2">Include any screen, action, or message that caused the problem.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <MessageSquareWarning className="h-3.5 w-3.5" />
            Your requests
          </div>
          <CardTitle>Request status</CardTitle>
          <CardDescription>Track the issues you have already sent to the admin team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {supportRequests.length ? (
            supportRequests.map((request: any) => {
              const status = String(request.status ?? "new");
              const isResolved = status === "resolved" || status === "handled";
              const isClaimed = status === "in_progress";

              return (
                <div key={request.id} className="rounded-2xl border bg-card/80 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={isResolved ? "default" : isClaimed ? "secondary" : "outline"}>
                          {isResolved ? "resolved" : isClaimed ? "in progress" : "pending"}
                        </Badge>
                        {request.topic ? <Badge variant="outline">{String(request.topic)}</Badge> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Sent: {request.created_at ? new Date(request.created_at).toLocaleString() : "Unknown"}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{String(request.message ?? "")}</p>
                    </div>
                    <div className="w-full max-w-sm space-y-2 rounded-xl border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                      <div>Assigned admin: {request.assigned_admin_email ? String(request.assigned_admin_email) : "Not assigned yet"}</div>
                      <div>
                        Resolved at: {request.handled_at ? new Date(request.handled_at).toLocaleString() : "Not resolved yet"}
                      </div>
                      <div>Resolution note: {request.resolution_notes ? String(request.resolution_notes) : "No note yet"}</div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
              You have not submitted any support requests yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
