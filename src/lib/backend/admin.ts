import "server-only";

import { createAppDataClient } from "@/lib/backend/data-client";

export function createBackendAdminClient() {
  return createAppDataClient();
}
