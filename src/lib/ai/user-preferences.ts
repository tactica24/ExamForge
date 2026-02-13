import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUserAiPreferences(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("preferred_explanation_language,low_data_mode")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    preferredLanguage: (data?.preferred_explanation_language as string | null) ?? "en",
    lowDataMode: Boolean(data?.low_data_mode)
  };
}
