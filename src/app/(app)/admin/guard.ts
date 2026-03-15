import "server-only";

import { isUserAdmin } from "@/lib/auth/admin";
import { createBackendServerClient } from "@/lib/backend/server";

export async function requireAdmin() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  const isAdmin = user ? await isUserAdmin(backend, user) : false;
  return { user, isAdmin };
}
