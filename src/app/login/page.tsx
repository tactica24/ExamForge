import Link from "next/link";
import { loginAction } from "@/app/login/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const sp = await props.searchParams;
  const next = sp.next ?? "";
  return (
    <AuthCard
      title="Welcome back"
      description="Log in to continue your plan, quizzes, and groups."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/signup">
            Create an account
          </Link>
        </div>
      }
    >
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
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" required />
        </div>
        <SubmitButton type="submit" className="w-full" pendingText="Logging in…">
          Log in
        </SubmitButton>
      </AuthFormState>
    </AuthCard>
  );
}
