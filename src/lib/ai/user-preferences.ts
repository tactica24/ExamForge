import "server-only";

import { createBackendServerClient } from "@/lib/backend/server";

export async function getUserAiPreferences(userId: string) {
  const backend = await createBackendServerClient();
  const { data } = await backend
    .from("profiles")
    .select("preferred_explanation_language,low_data_mode")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    preferredLanguage: (data?.preferred_explanation_language as string | null) ?? "en",
    lowDataMode: Boolean(data?.low_data_mode)
  };
}

