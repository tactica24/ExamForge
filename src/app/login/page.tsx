import Link from "next/link";
import { confirmSignupAction, loginAction, resendConfirmationCodeAction } from "@/app/login/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; verify?: string; verified?: string; error?: string; email?: string }>;
}) {
  const sp = await props.searchParams;
  const next = sp.next ?? "";
  const showVerifyHint = sp.verify === "1";
  const showVerifiedHint = sp.verified === "1";
  const authError = sp.error ? decodeURIComponent(sp.error) : "";
  const email = sp.email ?? "";
  const authErrorLower = authError.toLowerCase();
  const showConfirmationPanel =
    showVerifyHint || authErrorLower.includes("confirm") || authErrorLower.includes("verification");

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to continue your plan, objective questions, and groups."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/signup">
            Create an account
          </Link>
        </div>
      }
    >
      {showVerifiedHint ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
          Email confirmed. You can now log in.
        </div>
      ) : null}
      {showVerifyHint ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
          Account created. Check your email for the confirmation code, confirm your account, then log in.
        </div>
      ) : null}
      {authError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
          {authError}
        </div>
      ) : null}
      {showConfirmationPanel ? (
        <div className="rounded-lg border border-border/60 bg-card/70 p-4">
          <div className="mb-3 text-sm font-medium">Confirm your account</div>
          <div className="space-y-3">
            <AuthFormState action={confirmSignupAction}>
              <div className="space-y-2">
                <Label htmlFor="confirm_email">Email</Label>
                <Input id="confirm_email" name="email" type="email" defaultValue={email} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_code">Confirmation code</Label>
                <Input id="confirm_code" name="code" placeholder="123456" required />
              </div>
              <SubmitButton type="submit" className="w-full" pendingText="Confirming...">
                Confirm account
              </SubmitButton>
            </AuthFormState>
            {email ? (
              <AuthFormState action={resendConfirmationCodeAction}>
                <input type="hidden" name="email" value={email} />
                <SubmitButton type="submit" variant="outline" className="w-full" pendingText="Sending...">
                  Resend confirmation code
                </SubmitButton>
              </AuthFormState>
            ) : null}
          </div>
        </div>
      ) : null}
      <OAuthButtons />
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="text-xs text-muted-foreground">or</div>
        <div className="h-px flex-1 bg-border" />
      </div>
      <AuthFormState action={loginAction}>
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" defaultValue={email} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="Enter your password" required />
        </div>
        <SubmitButton type="submit" className="w-full" pendingText="Logging in...">
          Log in
        </SubmitButton>
      </AuthFormState>
    </AuthCard>
  );
}
