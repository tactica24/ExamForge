import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";
import { CAREER_CATALOG, type CareerRecord } from "@/lib/careers/catalog";

function normalizeCareerRow(row: any): CareerRecord {
  return {
    id: String(row?.id ?? row?.slug ?? ""),
    slug: String(row?.slug ?? ""),
    title: String(row?.title ?? ""),
    category: String(row?.category ?? "Careers"),
    summary: String(row?.summary ?? ""),
    courses: Array.isArray(row?.courses) ? row.courses.map((item: any) => String(item)) : [],
    workplaces: Array.isArray(row?.workplaces) ? row.workplaces.map((item: any) => String(item)) : [],
    jamb_subjects: Array.isArray(row?.jamb_subjects) ? row.jamb_subjects.map((item: any) => String(item)) : [],
    keywords: Array.isArray(row?.keywords) ? row.keywords.map((item: any) => String(item)) : [],
    is_active: row?.is_active !== false
  };
}

export async function listCareers() {
  const firebase = await createFirebaseServerClient();
  const { data, error } = await firebase.from("careers").select("*").eq("is_active", true).order("title", { ascending: true });
  if (error || !data?.length) return CAREER_CATALOG;
  return data.map(normalizeCareerRow);
}

export async function getCareerBySlug(slug: string) {
  const firebase = await createFirebaseServerClient();
  const { data } = await firebase.from("careers").select("*").eq("slug", slug).maybeSingle();
  if (data) return normalizeCareerRow(data);
  return CAREER_CATALOG.find((career) => career.slug === slug) ?? null;
}
