import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getFallbackTopics } from "@/lib/syllabi/fallback";

export async function getTopicsForExamSubject(args: { examId: string; examSlug: string; subject: string }) {
  const firebase = await createFirebaseServerClient();

  const { data } = await firebase
    .from("syllabi")
    .select("topics")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .maybeSingle();

  if (data?.topics && Array.isArray(data.topics)) {
    return data.topics as unknown as Array<{ title: string; path: string; subtopics?: string[]; resources?: any[] }>;
  }

  const fallback = getFallbackTopics(args.examSlug, args.subject);
  if (fallback) return fallback;

  return [];
}
