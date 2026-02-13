import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyOtpAction } from "@/app/login/verify/actions";

export default async function VerifyOtpPage(props: { searchParams: Promise<{ phone?: string }> }) {
  const sp = await props.searchParams;
  const phone = sp.phone ?? "";

  return (
    <AuthCard
      title="Enter your code"
      description="Type the one-time code sent to your phone."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive a code?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/login/otp">
            Try again
          </Link>
        </div>
      }
    >
      <AuthFormState action={verifyOtpAction}>
        <input type="hidden" name="phone" value={phone} />
        <div className="space-y-2">
          <Label htmlFor="token">Code</Label>
          <Input id="token" name="token" placeholder="123456" required />
        </div>
        <SubmitButton type="submit" className="w-full" pendingText="Verifying...">
          Verify
        </SubmitButton>
      </AuthFormState>
    </AuthCard>
  );
}
