import "server-only";

import { cache } from "react";
import { createFirebaseDataClient } from "@/lib/firebase/data-client";
import { getFirebaseAdminDb } from "@/lib/firebase/admin-app";

const BRANDING_DOC_ID = "branding";

export const DEFAULT_BRAND_NAME = "ACE NAIJA";
export const DEFAULT_BRAND_SUBTITLE = "Exam prep";

type BrandingRecord = {
  id?: string;
  logo_url?: unknown;
};

export const getBrandingSettings = cache(async () => {
  const db = getFirebaseAdminDb();
  if (!db) {
    return { logoUrl: null as string | null };
  }

  const firebase = createFirebaseDataClient(db);
  const { data } = await firebase.from("app_settings").select("*").eq("id", BRANDING_DOC_ID).maybeSingle();
  const record = (data ?? {}) as BrandingRecord;
  const logoUrl = typeof record.logo_url === "string" && /^https?:\/\//i.test(record.logo_url) ? record.logo_url : null;

  return { logoUrl };
});

export function getBrandingDocId() {
  return BRANDING_DOC_ID;
}
