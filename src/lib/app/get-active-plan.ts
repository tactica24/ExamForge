import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";

export async function getActivePlanForUser(userId: string) {
  const firebase = await createFirebaseServerClient();
  const { data: plan } = await firebase
    .from("user_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return plan;
}
