import { redirect } from "next/navigation";
import Link from "next/link";
import { createBackendServerClient } from "@/lib/backend/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaystackUpgradeButton } from "@/components/billing/paystack-upgrade-button";
import { Button } from "@/components/ui/button";
import { getBillingAccess } from "@/lib/billing/access";

export default async function BillingPage() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await backend
    .from("profiles")
    .select("subscription_tier,pro_until,created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const billingAccess = getBillingAccess(profile);
  const tier = billingAccess.status;

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your subscription.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current plan</CardTitle>
          <CardDescription>Upgrade for full subject access, groups, reminders, and the complete learning workflow.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={tier === "pro" ? "default" : "secondary"}>{String(tier).toUpperCase()}</Badge>
            <div className="text-sm text-muted-foreground">
              {tier === "pro"
                ? `You have full Pro access${billingAccess.proEndsAt ? ` until ${new Date(billingAccess.proEndsAt).toLocaleString()}` : "."}`
                : tier === "trial"
                  ? `Your free trial is active${billingAccess.trialEndsAt ? ` until ${new Date(billingAccess.trialEndsAt).toLocaleString()}` : "."}`
                  : "Trial ended. History, tests, and mock exams remain available, while full app features require Pro."}
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

    </div>
  );
}


