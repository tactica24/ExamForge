import Link from "next/link";
import { signupAction } from "@/app/signup/actions";
import { seedExamsNG } from "@/data/seed/exams";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignupFields } from "@/components/auth/signup-fields";

export default function SignupPage() {
  const examOptions = seedExamsNG.map((exam) => ({ slug: exam.slug, name: exam.name }));

  return (
    <AuthCard
      title="Create your account"
      description="Set up your profile, pick exam interests, and start learning with a personalized plan."
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
        <SignupFields examOptions={examOptions} />
      </AuthFormState>
    </AuthCard>
  );
}
