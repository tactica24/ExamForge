import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaystackUpgradeButton } from "@/components/billing/paystack-upgrade-button";
import { Button } from "@/components/ui/button";

export default async function BillingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("subscription_tier").eq("user_id", user.id).maybeSingle();
  const tier = (profile?.subscription_tier as any) ?? "free";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your subscription.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current plan</CardTitle>
          <CardDescription>Upgrade for unlimited quizzes, groups, and reminders.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={tier === "pro" ? "default" : "secondary"}>{String(tier).toUpperCase()}</Badge>
            <div className="text-sm text-muted-foreground">
              {tier === "pro" ? "You have Pro access." : "Free tier with limited features."}
            </div>
          </div>
          {tier === "pro" ? (
            <Button asChild variant="secondary">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          ) : (
            <PaystackUpgradeButton />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Paystack integration is Nigeria-first. For global rollout, add Stripe in `src/lib/billing/`.
      </p>
    </div>
  );
}

