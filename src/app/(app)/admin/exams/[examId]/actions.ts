"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { regenerateSyllabusWithAi } from "@/lib/syllabi/get";

async function assertAdmin() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  const isAdmin = (user?.app_metadata as any)?.role === "admin";
  if (!user || !isAdmin) throw new Error("Forbidden");
}

const UpsertSchema = z.object({
  exam_id: z.string().uuid(),
  subject: z.string().min(2).max(80),
  topics_json: z.string().min(2)
});

const GenerateSubjectSchema = z.object({
  exam_id: z.string().uuid(),
  exam_slug: z.string().min(2).max(50),
  subject: z.string().trim().min(2).max(80)
});

const GenerateAllSchema = z.object({
  exam_id: z.string().uuid(),
  exam_slug: z.string().min(2).max(50)
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

  let admin;
  try {
    admin = createFirebaseAdminClient();
  } catch {
    return {
      ok: false,
      message: "Firebase admin credentials are missing. Add FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 and redeploy."
    };
  }

  let error: { message?: string } | null = null;
  try {
    const result = await admin.from("syllabi").upsert(
      {
        exam_id: parsed.data.exam_id,
        subject: parsed.data.subject,
        topics,
        source_meta: { updated_by: "admin_ui" },
        last_updated: new Date().toISOString()
      },
      { onConflict: "exam_id,subject" }
    );
    error = result.error;
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to save syllabus." };
  }

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
  return { ok: true };
}

export async function generateSubjectSyllabusAiAction(_: unknown, formData: FormData) {
  const parsed = GenerateSubjectSchema.safeParse({
    exam_id: formData.get("exam_id"),
    exam_slug: formData.get("exam_slug"),
    subject: formData.get("subject")
  });
  if (!parsed.success) return { ok: false, message: "Invalid subject selection." };

  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  try {
    const aiTopics = await regenerateSyllabusWithAi({
      examId: parsed.data.exam_id,
      examSlug: parsed.data.exam_slug,
      subject: parsed.data.subject
    });

    if (!aiTopics?.length) {
      return {
        ok: false,
        message:
          "AI did not return valid syllabus topics for this subject. Check OpenAI model access/quota and try again."
      };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to generate syllabus for selected subject." };
  }

  revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
  return { ok: true };
}

function normalizeSubjects(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((subject) => String(subject).trim())
    .filter(Boolean)
    .slice(0, 60);
}

export async function generateAllExamSyllabiAction(_: unknown, formData: FormData) {
  const parsed = GenerateAllSchema.safeParse({
    exam_id: formData.get("exam_id"),
    exam_slug: formData.get("exam_slug")
  });
  if (!parsed.success) return { ok: false, message: "Invalid exam selection." };

  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  const firebase = await createFirebaseServerClient();
  const { data: exam, error } = await firebase.from("exams").select("subjects").eq("id", parsed.data.exam_id).maybeSingle();
  if (error) return { ok: false, message: error.message };

  const subjects = normalizeSubjects(exam?.subjects);
  if (!subjects.length) {
    return { ok: false, message: "No subjects configured for this exam." };
  }

  try {
    const failed: string[] = [];
    for (const subject of subjects) {
      const aiTopics = await regenerateSyllabusWithAi({
        examId: parsed.data.exam_id,
        examSlug: parsed.data.exam_slug,
        subject
      });

      if (!aiTopics?.length) {
        failed.push(subject);
      }
    }

    if (failed.length) {
      return {
        ok: false,
        message: `AI generation failed for ${failed.length} subject(s): ${failed.slice(0, 6).join(", ")}.`
      };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to generate syllabus for all subjects." };
  }

  revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
  return { ok: true };
}
