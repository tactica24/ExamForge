import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getFallbackExams } from "@/lib/exams/fallback";

export async function listActiveExams() {
  const firebase = await createFirebaseServerClient();
  const { data, error } = await firebase
    .from("exams")
    .select("*")
    .eq("is_active", true);

  if (error) return getFallbackExams();
  if (!data?.length) return getFallbackExams();
  return [...data].sort((left, right) => String(left?.name ?? "").localeCompare(String(right?.name ?? "")));
}
