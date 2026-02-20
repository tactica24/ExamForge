import { redirect } from "next/navigation";
import Link from "next/link";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { paystackVerify } from "@/lib/billing/paystack";
import { activateProSubscriptionFromPaystack } from "@/lib/billing/paystack-activation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BillingCallbackPage(props: { searchParams: Promise<{ reference?: string }> }) {
  const sp = await props.searchParams;
  const reference = sp.reference;

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
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
    const verification = await paystackVerify(reference);
    const activation = await activateProSubscriptionFromPaystack({
      firebase,
      verification,
      source: "callback",
      expectedUserId: user.id
    });

    if (!activation.ok) {
      throw new Error(activation.message);
    }

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
