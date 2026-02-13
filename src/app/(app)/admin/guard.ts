import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAdmin = (user?.app_metadata as any)?.role === "admin";
  return { user, isAdmin };
}
