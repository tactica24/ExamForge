import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { listCareers } from "@/lib/careers/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 18;

export default async function CareersPage(props: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const searchParams = await props.searchParams;
  const query = String(searchParams.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  const careers = await listCareers();
  const filtered = query
    ? careers.filter((career) => {
        const haystack = [career.title, career.category, ...career.keywords, ...career.courses].join(" ").toLowerCase();
        return haystack.includes(query);
      })
    : careers;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (nextPage > 1) params.set("page", String(nextPage));
    const suffix = params.toString();
    return suffix ? `/careers?${suffix}` : "/careers";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Careers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore major JAMB-linked careers, the courses that lead there, and the subject combinations you need.
          </p>
        </div>
        <Badge variant="secondary">{filtered.length} careers</Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <form action="/careers" className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={query} placeholder="Search careers, courses, or fields" className="pl-9" />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pageItems.map((career) => (
          <Card key={career.slug} className="h-full">
            <CardHeader>
              <CardTitle className="text-base">{career.title}</CardTitle>
              <CardDescription>{career.category}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-4">{career.summary.split("\n")[0]}</p>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">JAMB combo</div>
                <div className="flex flex-wrap gap-2">
                  {career.jamb_subjects.map((subject) => (
                    <Badge key={subject} variant="secondary">{subject}</Badge>
                  ))}
                </div>
              </div>
              <Button asChild className="w-full">
                <Link href={`/careers/${career.slug}`}>Open career</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex gap-2">
          {currentPage <= 1 ? (
            <Button variant="outline" disabled>
              Previous
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={pageHref(currentPage - 1)}>Previous</Link>
            </Button>
          )}
          {currentPage >= totalPages ? (
            <Button variant="outline" disabled>
              Next
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={pageHref(currentPage + 1)}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
