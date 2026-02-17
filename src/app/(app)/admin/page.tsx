import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/app/(app)/admin/guard";

export default async function AdminHomePage() {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add/edit exams and syllabi. To enable admin access, set your Firebase user `app_metadata.role=admin`.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tools</CardTitle>
          <CardDescription>Exam and content management.</CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <Button asChild>
              <Link href="/admin/exams">Manage exams</Link>
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground">Access denied.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

