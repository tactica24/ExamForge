import "server-only";

import { createBackendServerClient } from "@/lib/backend/server";

export async function requireAdmin() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  const isAdmin = (user?.app_metadata as any)?.role === "admin";
  return { user, isAdmin };
}
