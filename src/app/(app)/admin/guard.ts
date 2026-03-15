import "server-only";

import { createBackendServerClient } from "@/lib/backend/server";

export async function requireAdmin() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  const { data: profile } = user?.id
    ? await backend.from("profiles").select("role").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const isAdmin =
    (user?.app_metadata as any)?.role === "admin" || String((profile as any)?.role ?? "").toLowerCase() === "admin";
  return { user, isAdmin };
}
