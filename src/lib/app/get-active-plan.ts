import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getActivePlanForUser(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data: plan } = await supabase
    .from("user_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return plan;
}

