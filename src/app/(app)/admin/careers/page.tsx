import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, Sparkles } from "lucide-react";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { CAREER_CATALOG } from "@/lib/careers/catalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { generateCareerCatalogAction } from "@/app/(app)/admin/careers/actions";

export const dynamic = "force-dynamic";

export default async function AdminCareersPage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const firebase = await createFirebaseServerClient();
  const { count } = await firebase.from("careers").select("id", { head: true, count: "exact" });
  const totalCareers = count ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,12,27,0.85)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Careers content
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Career catalogue generator</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Generate and cache the JAMB-focused careers library once, then serve it to learners without repeated AI calls.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/admin">Back</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catalog status</CardTitle>
            <CardDescription>These careers are designed for students planning university routes that rely on JAMB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stored careers</div>
              <div className="mt-2 text-3xl font-semibold">{totalCareers}</div>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Seed catalog size</div>
              <div className="mt-2 text-3xl font-semibold">{CAREER_CATALOG.length}</div>
            </div>
            <p className="text-sm text-muted-foreground">
              The stored collection is what users search and open in the app. Regenerating updates existing entries and adds any new careers in the seed catalog.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate careers</CardTitle>
            <CardDescription>Run this once now, then rerun whenever you expand the catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              Each record stores the career summary, related courses, workplaces, and JAMB subject combination. This avoids repeated generation at runtime.
            </div>
            <AuthFormState action={generateCareerCatalogAction}>
              <SubmitButton type="submit" pendingText="Generating..." className="w-full sm:w-auto">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate careers catalog
              </SubmitButton>
            </AuthFormState>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
