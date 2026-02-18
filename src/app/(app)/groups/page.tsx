import Link from "next/link";
import { redirect } from "next/navigation";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { listActiveExams } from "@/lib/exams/list";
import { deleteGroupAction, joinSubjectGroupAction, leaveGroupAction } from "@/app/(app)/groups/actions";

export default async function GroupsPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await firebase.from("group_members").select("group_id,groups(*)").eq("user_id", user.id);

  const groups = memberships?.map((m: any) => m.groups).filter(Boolean) ?? [];
  const groupCount = groups.length;

  const { data: subjects } = await firebase.from("user_exam_subjects").select("exam_id,subject").eq("user_id", user.id);

  const exams = await listActiveExams();
  const examNameById = new Map(exams.map((exam) => [exam.id, exam.name]));

  const examIds = Array.from(new Set((subjects ?? []).map((s: any) => s.exam_id).filter(Boolean)));
  const { data: allGroups } = examIds.length
    ? await firebase.from("groups").select("*").in("exam_id", examIds)
    : { data: [] as any[] };

  const groupMemberCounts = new Map<string, number>();
  for (const g of [...groups, ...(allGroups ?? [])]) {
    if (!g?.id || groupMemberCounts.has(g.id)) continue;
    const { count } = await firebase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id);
    groupMemberCounts.set(g.id, count ?? 0);
  }

  const membershipBySubject = new Set(groups.map((g: any) => `${g.exam_id}::${g.subject}`));
  const suggestions =
    subjects?.map((subject: any) => {
      const key = `${subject.exam_id}::${subject.subject}`;
      const matches =
        allGroups?.filter((g: any) => g.exam_id === subject.exam_id && g.subject === subject.subject) ?? [];
      const available = matches.find((g: any) => (groupMemberCounts.get(g.id) ?? 0) < 15) ?? null;
      return {
        key,
        exam_id: subject.exam_id,
        exam_name: examNameById.get(subject.exam_id) ?? "Exam",
        subject: subject.subject,
        group: available
      };
    }) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">Collaborative mode: chat, challenges, and peer support.</p>
        </div>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/onboarding">Find a new group</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suggested groups</CardTitle>
          <CardDescription>Select up to 3 groups based on your subjects.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {suggestions.length ? (
            suggestions.map((s) => {
              const already = membershipBySubject.has(s.key);
              const members = s.group ? groupMemberCounts.get(s.group.id) ?? 0 : 0;
              return (
                <Card key={s.key} className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {s.subject} | {s.exam_name}
                    </CardTitle>
                    <CardDescription>
                      {s.group?.name ?? `${s.subject} group`} | {members}/15 members
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {already ? (
                      <Button asChild className="w-full">
                        <Link href={`/groups/${s.group?.id ?? ""}`}>Open group</Link>
                      </Button>
                    ) : (
                      <AuthFormState action={joinSubjectGroupAction}>
                        <input type="hidden" name="exam_id" value={s.exam_id} />
                        <input type="hidden" name="subject" value={s.subject} />
                        <SubmitButton type="submit" pendingText="Joining..." className="w-full" disabled={groupCount >= 3}>
                          {groupCount >= 3 ? "Group limit reached" : s.group ? "Join group" : "Create and join"}
                        </SubmitButton>
                      </AuthFormState>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">Add subjects in settings to get group suggestions.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.length ? (
          groups.map((g: any) => (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {g.name ?? g.subject} | {g.pace}
                </CardTitle>
                <CardDescription>
                  Level: {g.level} | TZ: {g.timezone} | {groupMemberCounts.get(g.id) ?? 0}/15 members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Button asChild className="w-full">
                    <Link href={`/groups/${g.id}`}>Open chat</Link>
                  </Button>
                  <AuthFormState action={leaveGroupAction}>
                    <input type="hidden" name="group_id" value={g.id} />
                    <SubmitButton type="submit" pendingText="Leaving..." variant="secondary" className="w-full">
                      Leave group
                    </SubmitButton>
                  </AuthFormState>
                  <AuthFormState action={deleteGroupAction}>
                    <input type="hidden" name="group_id" value={g.id} />
                    <SubmitButton type="submit" pendingText="Deleting..." variant="outline" className="w-full">
                      Delete group
                    </SubmitButton>
                  </AuthFormState>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>No groups yet</CardTitle>
              <CardDescription>Choose group mode in onboarding to get matched automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/onboarding">Start onboarding</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
