"use server";

import { createFirebaseAdminClient } from "@/lib/firebase/admin";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { CAREER_CATALOG } from "@/lib/careers/catalog";

async function assertAdmin() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  const isAdmin = (user?.app_metadata as any)?.role === "admin";
  if (!user || !isAdmin) throw new Error("Forbidden");
}

export async function generateCareerCatalogAction() {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  let admin;
  try {
    admin = createFirebaseAdminClient();
  } catch {
    return {
      ok: false,
      message: "Firebase admin credentials are missing. Add FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 and redeploy."
    };
  }

  const payload = CAREER_CATALOG.map((career) => ({
    id: career.id,
    slug: career.slug,
    title: career.title,
    category: career.category,
    summary: career.summary,
    courses: career.courses,
    workplaces: career.workplaces,
    jamb_subjects: career.jamb_subjects,
    keywords: career.keywords,
    is_active: true
  }));

  const { error } = await admin.from("careers").upsert(payload, { onConflict: "slug" });
  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, message: `Career catalog updated with ${payload.length} careers.` };
}
