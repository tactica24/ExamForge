import "server-only";

import { createBackendServerClient } from "@/lib/backend/server";
import { getFallbackExams } from "@/lib/exams/fallback";

export async function listActiveExams() {
  const backend = await createBackendServerClient();
  const { data, error } = await backend
    .from("exams")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return getFallbackExams();
  if (!data?.length) return getFallbackExams();
  return data;
}

