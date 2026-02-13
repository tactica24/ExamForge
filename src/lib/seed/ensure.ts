import "server-only";

import { seedExamsNG, seedSyllabiNG } from "@/data/seed/exams";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function ensureSeedExamExists(args: { slug: string }) {
  const exam = seedExamsNG.find((e) => e.slug === args.slug);
  if (!exam) throw new Error(`No seed exam found for slug: ${args.slug}`);

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("exams").select("id,slug").eq("slug", exam.slug).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("exams")
    .insert({
      slug: exam.slug,
      name: exam.name,
      country_code: exam.country_code,
      description: exam.description,
      subjects: exam.subjects,
      syllabus_sources: exam.syllabus_sources,
      is_active: true
    })
    .select("id")
    .single();
  if (error) throw error;

  const syllabi = seedSyllabiNG.filter((s) => s.exam_slug === exam.slug);
  if (syllabi.length) {
    await admin.from("syllabi").upsert(
      syllabi.map((s) => ({
        exam_id: created.id,
        subject: s.subject,
        topics: s.topics,
        source_meta: { seeded: true }
      })),
      { onConflict: "exam_id,subject" }
    );
  }

  return created.id;
}

