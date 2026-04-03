import Link from "next/link";
import { recoverPasswordAction } from "@/app/login/recover/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RecoverPasswordPage() {
  return (
    <AuthCard
      title="Recover your password"
      description="Enter your email and we'll send you a secure password reset link."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/login">
            Back to log in
          </Link>
        </div>
      }
    >
      <AuthFormState action={recoverPasswordAction}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <SubmitButton type="submit" className="w-full" pendingText="Sending reset link...">
          Send reset link
        </SubmitButton>
      </AuthFormState>
    </AuthCard>
  );
}
