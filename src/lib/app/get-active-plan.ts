import "server-only";

import { createBackendServerClient } from "@/lib/backend/server";

export async function getActivePlanForUser(userId: string) {
  const backend = await createBackendServerClient();
  const { data: plan } = await backend
    .from("user_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return plan;
}

