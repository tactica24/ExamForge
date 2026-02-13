"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ExamSchema = z.object({
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(60),
  country_code: z.string().min(2).max(10),
  description: z.string().max(240).optional(),
  subjects: z.string().min(2)
});

async function assertAdmin() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAdmin = (user?.app_metadata as any)?.role === "admin";
  if (!user || !isAdmin) throw new Error("Forbidden");
}

export async function createExamAction(_: unknown, formData: FormData) {
  const parsed = ExamSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    country_code: formData.get("country_code"),
    description: (formData.get("description") as string | null) || undefined,
    subjects: formData.get("subjects")
  });
  if (!parsed.success) return { ok: false, message: "Invalid exam fields." };

  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  const subjects = parsed.data.subjects
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("exams").insert({
    slug: parsed.data.slug,
    name: parsed.data.name,
    country_code: parsed.data.country_code.toUpperCase(),
    description: parsed.data.description ?? null,
    subjects,
    syllabus_sources: [],
    is_active: true
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

