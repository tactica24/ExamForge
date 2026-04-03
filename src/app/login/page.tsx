import Link from "next/link";
import { loginAction } from "@/app/login/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { sanitizeNextPath } from "@/lib/auth/redirects";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; verify?: string; verified?: string; reset?: string }>;
}) {
  const sp = await props.searchParams;
  const next = sanitizeNextPath(sp.next) ?? "";
  const showVerifyHint = sp.verify === "1";
  const showVerifiedHint = sp.verified === "1";
  const showResetHint = sp.reset === "1";

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
      {showResetHint ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
          Password updated. Log in with your new password.
        </div>
      ) : null}
      {showVerifyHint ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
          Account created. Check your email and confirm your account, then log in.
        </div>
      ) : null}
      <OAuthButtons nextPath={next} />
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="text-xs text-muted-foreground">or</div>
        <div className="h-px flex-1 bg-border" />
      </div>
      <AuthFormState action={loginAction}>
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link className="text-sm text-foreground underline underline-offset-4" href="/login/recover">
              Forgot password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" placeholder="Enter your password" required />
        </div>
        <SubmitButton type="submit" className="w-full" pendingText="Logging in...">
          Log in
        </SubmitButton>
      </AuthFormState>
    </AuthCard>
  );
}
