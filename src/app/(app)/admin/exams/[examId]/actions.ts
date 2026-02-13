"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAdmin = (user?.app_metadata as any)?.role === "admin";
  if (!user || !isAdmin) throw new Error("Forbidden");
}

const UpsertSchema = z.object({
  exam_id: z.string().uuid(),
  subject: z.string().min(2).max(80),
  topics_json: z.string().min(2)
});

export async function upsertSyllabusAction(_: unknown, formData: FormData) {
  const parsed = UpsertSchema.safeParse({
    exam_id: formData.get("exam_id"),
    subject: formData.get("subject"),
    topics_json: formData.get("topics_json")
  });
  if (!parsed.success) return { ok: false, message: "Invalid syllabus form." };

  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  let topics: any;
  try {
    topics = JSON.parse(parsed.data.topics_json);
    if (!Array.isArray(topics)) throw new Error("topics must be an array");
  } catch (e: any) {
    return { ok: false, message: `Invalid JSON: ${e?.message ?? "parse error"}` };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("syllabi").upsert(
    {
      exam_id: parsed.data.exam_id,
      subject: parsed.data.subject,
      topics,
      source_meta: { updated_by: "admin_ui" },
      last_updated: new Date().toISOString()
    },
    { onConflict: "exam_id,subject" }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

