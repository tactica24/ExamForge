import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";

export async function requireAdmin() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  const isAdmin = (user?.app_metadata as any)?.role === "admin";
  return { user, isAdmin };
}
