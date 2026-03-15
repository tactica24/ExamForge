import Link from "next/link";
import { redirect } from "next/navigation";
import { adminLoginAction } from "@/app/admin1/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isUserAdmin } from "@/lib/auth/admin";
import { createBackendServerClient } from "@/lib/backend/server";

export default async function AdminEntryPage() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();

  if (user && (await isUserAdmin(backend, user))) {
    redirect("/admin");
  }

  return (
    <AuthCard
      title="Admin access"
      description="Use the dedicated admin login path. This bypasses the learner onboarding route."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Need the learner app instead?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/login">
            Open standard login
          </Link>
        </div>
      }
    >
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
        Only approved admin accounts can continue from this page.
      </div>
      <AuthFormState action={adminLoginAction}>
        <div className="space-y-2">
          <Label htmlFor="admin_email">Admin email</Label>
          <Input
            id="admin_email"
            name="email"
            type="email"
            placeholder="admin@ace-naija.com"
            defaultValue={user?.email ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin_password">Password</Label>
          <Input id="admin_password" name="password" type="password" placeholder="Enter your password" required />
        </div>
        <SubmitButton type="submit" className="w-full" pendingText="Checking admin access...">
          Continue to admin
        </SubmitButton>
      </AuthFormState>
    </AuthCard>
  );
}
