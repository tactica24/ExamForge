import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOtpAction } from "@/app/login/otp/actions";

export default function LoginOtpPage() {
  return (
    <AuthCard
      title="Login with OTP"
      description="We'll send a one-time code to your phone (configure SMS provider in Firebase)."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Prefer email/password?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/login">
            Log in
          </Link>
        </div>
      }
    >
      <AuthFormState action={sendOtpAction}>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" placeholder="+234..." required />
        </div>
        <SubmitButton type="submit" className="w-full" pendingText="Sending...">
          Send code
        </SubmitButton>
      </AuthFormState>
    </AuthCard>
  );
}
