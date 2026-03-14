import "server-only";

import { cache } from "react";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { isAllowedAssetUrl } from "@/lib/backend/storage";

const BRANDING_DOC_ID = "branding";

export const DEFAULT_BRAND_NAME = "ACE NAIJA";
export const DEFAULT_BRAND_SUBTITLE = "Exam prep";

type BrandingRecord = {
  id?: string;
  logo_url?: unknown;
};

export const getBrandingSettings = cache(async () => {
  const backend = createBackendAdminClient();
  const { data } = await backend.from("app_settings").select("*").eq("id", BRANDING_DOC_ID).maybeSingle();
  const record = (data ?? {}) as BrandingRecord;
  const logoUrl = typeof record.logo_url === "string" && isAllowedAssetUrl(record.logo_url) ? record.logo_url : null;

  return { logoUrl };
});

export function getBrandingDocId() {
  return BRANDING_DOC_ID;
}
