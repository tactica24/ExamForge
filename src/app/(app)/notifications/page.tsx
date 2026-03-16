import Link from "next/link";
import { redirect } from "next/navigation";
import { BellDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createFirebaseServerClient } from "@/lib/firebase/server";

export default async function NotificationsPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: notifications }, { data: prefs }] = await Promise.all([
    firebase
      .from("notifications")
      .select("id,message,status,channel,scheduled_for,sent_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    firebase.from("notification_prefs").select("reminders,reminder_time").eq("user_id", user.id).maybeSingle()
  ]);

  const reminderSchedule = Array.isArray((prefs as any)?.reminders)
    ? ((prefs as any).reminders as Array<Record<string, unknown>>)
        .map((entry) => ({
          time: String(entry?.time ?? "").trim(),
          channel: String(entry?.channel ?? "in_app").trim()
        }))
        .filter((entry) => /^\d{2}:\d{2}$/.test(entry.time))
    : prefs?.reminder_time
      ? [{ time: String(prefs.reminder_time), channel: "in_app" }]
      : [];

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your latest in-app reminders, alerts, and reminder schedule.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/settings">Manage reminders</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <BellDot className="h-3.5 w-3.5" />
            Reminder schedule
          </div>
          <CardTitle>Study reminder windows</CardTitle>
          <CardDescription>These are the reminder times currently configured on your account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {reminderSchedule.length ? (
            reminderSchedule.map((entry) => (
              <Badge key={`${entry.channel}-${entry.time}`} variant="secondary">
                {entry.channel.replace("_", " ")} at {entry.time}
              </Badge>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No reminder times set yet.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest alerts</CardTitle>
          <CardDescription>Recent notifications sent by the platform to keep you moving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications?.length ? (
            notifications.map((notification) => (
              <div key={notification.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{notification.channel}</Badge>
                  <Badge variant={notification.status === "sent" ? "secondary" : "outline"}>{notification.status}</Badge>
                </div>
                <div className="mt-3 text-sm font-medium">{notification.message}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {notification.sent_at
                    ? `Sent ${new Date(notification.sent_at).toLocaleString()}`
                    : `Scheduled ${new Date(notification.scheduled_for ?? notification.created_at).toLocaleString()}`}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
              No notifications yet. Once reminders start running, they will show up here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
