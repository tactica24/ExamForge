import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFallbackExams } from "@/lib/exams/fallback";

export async function listActiveExams() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return getFallbackExams();
  if (!data?.length) return getFallbackExams();
  return data;
}

