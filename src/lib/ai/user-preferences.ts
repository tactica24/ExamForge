import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";

export async function getUserAiPreferences(userId: string) {
  const firebase = await createFirebaseServerClient();
  const { data } = await firebase
    .from("profiles")
    .select("preferred_explanation_language,low_data_mode")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    preferredLanguage: (data?.preferred_explanation_language as string | null) ?? "en",
    lowDataMode: Boolean(data?.low_data_mode)
  };
}
