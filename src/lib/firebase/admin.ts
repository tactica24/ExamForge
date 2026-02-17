import "server-only";

import { createFirebaseDataClient } from "@/lib/firebase/data-client";
import { getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin-app";

export function createFirebaseAdminClient() {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("Firebase admin credentials are required for admin operations.");
  }

  return createFirebaseDataClient(getFirebaseAdminDb());
}