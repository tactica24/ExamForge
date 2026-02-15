import Link from "next/link";
import { signupAction } from "@/app/signup/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Build your personalized study plan, practice daily, and track real progress."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/login">
            Log in
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
      <AuthFormState action={signupAction}>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Your name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location (optional)</Label>
          <Input id="location" name="location" placeholder="City, Country" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="********" required />
        </div>
        <SubmitButton type="submit" className="w-full" pendingText="Creating...">
          Continue
        </SubmitButton>
      </AuthFormState>
    </AuthCard>
  );
}


