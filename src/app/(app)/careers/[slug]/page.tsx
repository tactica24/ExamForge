import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getCareerBySlug, listCareers } from "@/lib/careers/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function CareerDetailPage(props: { params: Promise<{ slug: string }> }) {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { slug } = await props.params;
  const career = await getCareerBySlug(slug);
  if (!career) notFound();

  const related = (await listCareers())
    .filter((item) => item.slug !== career.slug && item.category === career.category)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{career.category}</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{career.title}</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/careers">Back to careers</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Career overview</CardTitle>
            <CardDescription>What this path looks like and where it can lead.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {career.summary.split("\n").map((line) => (
              <p key={line} className="text-sm leading-7 text-muted-foreground">
                {line}
              </p>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Courses of study</CardTitle>
              <CardDescription>University courses that commonly lead into this career.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {career.courses.map((course) => (
                <div key={course} className="rounded-xl border bg-card px-3 py-2 text-sm font-medium">
                  {course}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">JAMB subject combination</CardTitle>
              <CardDescription>Use this as a reliable planning guide before registration.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {career.jamb_subjects.map((subject) => (
                <Badge key={subject} variant="secondary">{subject}</Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Common workplaces</CardTitle>
              <CardDescription>Examples of where professionals in this field often work.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {career.workplaces.map((workplace) => (
                <div key={workplace} className="rounded-xl border bg-card px-3 py-2 text-sm">
                  {workplace}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {related.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related careers</CardTitle>
            <CardDescription>Other nearby paths students often compare with this one.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {related.map((item) => (
              <Link key={item.slug} href={`/careers/${item.slug}`} className="rounded-2xl border bg-card p-4 hover:bg-accent">
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.category}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
