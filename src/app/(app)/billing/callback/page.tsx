import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paystackVerify } from "@/lib/billing/paystack";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function BillingCallbackPage(props: { searchParams: Promise<{ reference?: string }> }) {
  const sp = await props.searchParams;
  const reference = sp.reference;

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!reference) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Missing reference</CardTitle>
          <CardDescription>We couldn&apos;t verify your payment.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/billing">Back to billing</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  try {
    const data = await paystackVerify(reference);
    const paid = data?.status === "success";
    const metaUserId = data?.metadata?.user_id;

    if (!paid || metaUserId !== user.id) {
      throw new Error("Payment not verified for this account.");
    }

    await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        provider: "paystack",
        tier: "pro",
        status: "active",
        current_period_end: null
      },
      { onConflict: "user_id,provider" }
    );
    await supabase.from("profiles").update({ subscription_tier: "pro" }).eq("user_id", user.id);

    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Payment verified</CardTitle>
          <CardDescription>Your Pro access is now active.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/settings">Settings</Link>
          </Button>
        </CardContent>
      </Card>
    );
  } catch (e: any) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Verification failed</CardTitle>
          <CardDescription>{e?.message ?? "We could not confirm your payment."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/billing">Back to billing</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
}
