"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { isUserAdmin } from "@/lib/auth/admin";
import { createBackendServerClient } from "@/lib/backend/server";
import { isBackendStorageConfigured, uploadBackendStorageObject } from "@/lib/backend/storage";
import { parseSyllabusDocument } from "@/lib/syllabi/document";
import { regenerateSyllabusWithAiDetailed } from "@/lib/syllabi/get";

async function assertAdmin() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  const isAdmin = user ? await isUserAdmin(backend, user) : false;
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

const UploadDocumentSchema = z.object({
  exam_id: z.string().uuid(),
  exam_slug: z.string().min(2).max(50),
  subject: z.string().trim().min(2).max(80)
});

const DeleteSyllabusSchema = z.object({
  exam_id: z.string().uuid(),
  subject: z.string().trim().min(2).max(80)
});

const RemoveExamSubjectSchema = z.object({
  exam_id: z.string().uuid(),
  subject: z.string().trim().min(2).max(80)
});

const DeleteExamSchema = z.object({
  exam_id: z.string().uuid(),
  exam_slug: z.string().trim().min(2).max(80),
  confirm_slug: z.string().trim().min(2).max(80)
});

function extensionForSyllabus(fileName: string, mimeType: string) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (lower.endsWith(".md") || mimeType === "text/markdown") return "md";
  return "txt";
}

function toStorageSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function normalizeSyllabusSources(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 100);
}

function normalizeSubjects(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((subject) => String(subject).trim())
    .filter(Boolean)
    .slice(0, 60);
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function chunk<T>(values: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}

async function generateSubjectsNow(args: {
  examId: string;
  examSlug: string;
  subjects: string[];
}) {
  const failures: string[] = [];
  let generated = 0;

  // Keep concurrency low to reduce provider rate-limit spikes for admin bulk runs.
  const batches = chunk(args.subjects, 2);
  for (const batch of batches) {
    const settled = await Promise.allSettled(
      batch.map(async (subject) => {
        const result = await regenerateSyllabusWithAiDetailed({
          examId: args.examId,
          examSlug: args.examSlug,
          subject,
          sourceMeta: {
            generated_by: "admin_generate_all"
          }
        });

        if (!result.topics?.length) {
          throw new Error(result.error ?? `No topics generated for ${subject}.`);
        }

        return subject;
      })
    );

    settled.forEach((entry, idx) => {
      const subject = batch[idx];
      if (entry.status === "fulfilled") {
        generated += 1;
        return;
      }

      failures.push(`${subject}: ${String(entry.reason instanceof Error ? entry.reason.message : entry.reason ?? "failed").slice(0, 140)}`);
    });
  }

  return { generated, failures };
}

async function deleteByIn(admin: ReturnType<typeof createBackendAdminClient>, table: string, field: string, values: string[]) {
  const unique = Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
  if (!unique.length) return;

  for (const batch of chunk(unique, 30)) {
    await admin.from(table).delete().in(field, batch);
  }
}

export async function uploadSubjectSyllabusDocumentAction(_: unknown, formData: FormData) {
  const parsed = UploadDocumentSchema.safeParse({
    exam_id: formData.get("exam_id"),
    exam_slug: formData.get("exam_slug"),
    subject: formData.get("subject")
  });
  if (!parsed.success) return { ok: false, message: "Invalid syllabus upload form." };

  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Attach a syllabus file (PDF, TXT, or MD)." };
  }

  let parsedDoc: Awaited<ReturnType<typeof parseSyllabusDocument>>;
  try {
    parsedDoc = await parseSyllabusDocument(file);
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Could not read syllabus file." };
  }

  let documentUrl: string | null = null;
  let documentStorageError: string | null = null;

  if (isBackendStorageConfigured()) {
    try {
      const ext = extensionForSyllabus(parsedDoc.fileName, parsedDoc.mimeType);
      const storagePath = [
        "syllabi",
        toStorageSlug(parsed.data.exam_slug),
        toStorageSlug(parsed.data.subject),
        `${Date.now()}-${randomUUID()}.${ext}`
      ].join("/");
      const uploaded = await uploadBackendStorageObject({
        path: storagePath,
        bytes: parsedDoc.bytes,
        contentType: parsedDoc.mimeType,
        cacheControl: "private, max-age=0, no-store"
      });
      documentUrl = uploaded.url;
    } catch (e: any) {
      documentStorageError = e?.message ? String(e.message).slice(0, 240) : "storage_error";
    }
  }

  try {
    const ai = await regenerateSyllabusWithAiDetailed({
      examId: parsed.data.exam_id,
      examSlug: parsed.data.exam_slug,
      subject: parsed.data.subject,
      sourceText: parsedDoc.extractedText,
      sourceMeta: {
        generated_by: "admin_upload",
        model_input: "uploaded_document",
        document_name: parsedDoc.fileName,
        document_type: parsedDoc.mimeType,
        document_size_bytes: parsedDoc.sizeBytes,
        extraction_chars: parsedDoc.extractedText.length,
        document_uploaded_at: new Date().toISOString(),
        document_url: documentUrl ?? undefined,
        document_storage: documentUrl ? "backend_storage" : "not_configured",
        document_storage_error: documentStorageError ?? undefined
      }
    });

    if (!ai.topics?.length) {
      return {
        ok: false,
        message: `AI generation failed for ${parsed.data.subject}. ${ai.error ?? "No valid topic JSON returned."}`
      };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to generate syllabus from uploaded document." };
  }

  if (documentUrl) {
    const backend = await createBackendServerClient();
    const { data: exam } = await backend
      .from("exams")
      .select("syllabus_sources")
      .eq("id", parsed.data.exam_id)
      .maybeSingle();
    const existing = normalizeSyllabusSources(exam?.syllabus_sources);
    const next = [documentUrl, ...existing.filter((entry) => entry !== documentUrl)].slice(0, 100);
    await backend.from("exams").update({ syllabus_sources: next }).eq("id", parsed.data.exam_id);
  }

  revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
  return { ok: true };
}

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
    admin = createBackendAdminClient();
  } catch {
    return {
      ok: false,
      message: "Backend datastore credentials are missing. Configure the datastore service-account credentials and redeploy."
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
    const ai = await regenerateSyllabusWithAiDetailed({
      examId: parsed.data.exam_id,
      examSlug: parsed.data.exam_slug,
      subject: parsed.data.subject
    });

    if (!ai.topics?.length) {
      return {
        ok: false,
        message: `AI generation failed for ${parsed.data.subject}. ${ai.error ?? "No valid topic JSON returned."}`
      };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to generate syllabus for selected subject." };
  }

  revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
  return { ok: true };
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

  const backend = await createBackendServerClient();

  const { data: exam, error } = await backend
    .from("exams")
    .select("subjects")
    .eq("id", parsed.data.exam_id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  const allSubjects = normalizeSubjects(exam?.subjects);
  if (!allSubjects.length) {
    return { ok: false, message: "No subjects configured for this exam." };
  }

  const { data: existing } = await backend
    .from("syllabi")
    .select("subject")
    .eq("exam_id", parsed.data.exam_id);

  const existingSubjects = new Set((existing ?? []).map((row: any) => String(row.subject).trim().toLowerCase()));
  const missingSubjects = allSubjects.filter((subject) => !existingSubjects.has(subject.toLowerCase()));

  if (!missingSubjects.length) {
    return {
      ok: false,
      message: "All configured subjects already have syllabi. Delete a subject syllabus first if you need regeneration."
    };
  }

  const result = await generateSubjectsNow({
    examId: parsed.data.exam_id,
    examSlug: parsed.data.exam_slug,
    subjects: missingSubjects
  });

  if (result.failures.length) {
    revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
    return {
      ok: false,
      message: `Generated ${result.generated}/${missingSubjects.length} subjects. Failed: ${result.failures.slice(0, 3).join(" | ")}`
    };
  }

  revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
  redirect(`/admin/exams/${parsed.data.exam_id}`);
}

export async function deleteSyllabusAction(_: unknown, formData: FormData) {
  const parsed = DeleteSyllabusSchema.safeParse({
    exam_id: formData.get("exam_id"),
    subject: formData.get("subject")
  });
  if (!parsed.success) return { ok: false, message: "Invalid syllabus delete request." };

  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  let admin;
  try {
    admin = createBackendAdminClient();
  } catch {
    return {
      ok: false,
      message: "Backend datastore credentials are missing. Configure the datastore service-account credentials and redeploy."
    };
  }

  const { error } = await admin
    .from("syllabi")
    .delete()
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
  return { ok: true };
}

export async function removeExamSubjectAction(_: unknown, formData: FormData) {
  const parsed = RemoveExamSubjectSchema.safeParse({
    exam_id: formData.get("exam_id"),
    subject: formData.get("subject")
  });
  if (!parsed.success) return { ok: false, message: "Invalid subject removal request." };

  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  const backend = await createBackendServerClient();
  const { data: exam } = await backend.from("exams").select("subjects").eq("id", parsed.data.exam_id).maybeSingle();
  const subjects = normalizeSubjects(exam?.subjects);
  const target = parsed.data.subject.trim().toLowerCase();

  if (!subjects.some((subject) => subject.toLowerCase() === target)) {
    return { ok: false, message: "Subject not found on this exam." };
  }
  if (subjects.length <= 1) {
    return { ok: false, message: "An exam must keep at least one subject. Delete the exam instead." };
  }

  const nextSubjects = subjects.filter((subject) => subject.toLowerCase() !== target);

  let admin;
  try {
    admin = createBackendAdminClient();
  } catch {
    return {
      ok: false,
      message: "Backend datastore credentials are missing. Configure the datastore service-account credentials and redeploy."
    };
  }

  const updateExam = await admin.from("exams").update({ subjects: nextSubjects }).eq("id", parsed.data.exam_id);
  if (updateExam.error) return { ok: false, message: updateExam.error.message };

  await admin.from("syllabi").delete().eq("exam_id", parsed.data.exam_id).eq("subject", parsed.data.subject);
  await admin.from("user_exam_subjects").delete().eq("exam_id", parsed.data.exam_id).eq("subject", parsed.data.subject);

  const { data: plans } = await admin
    .from("user_plans")
    .select("id")
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject);
  const planIds = (plans ?? []).map((row: any) => String(row.id)).filter(Boolean);
  await deleteByIn(admin, "plan_items", "plan_id", planIds);
  await admin.from("user_plans").delete().eq("exam_id", parsed.data.exam_id).eq("subject", parsed.data.subject);

  const { data: quizzes } = await admin
    .from("quizzes")
    .select("id")
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject);
  const quizIds = (quizzes ?? []).map((row: any) => String(row.id)).filter(Boolean);
  await deleteByIn(admin, "quiz_questions", "quiz_id", quizIds);
  await deleteByIn(admin, "user_quiz_results", "quiz_id", quizIds);
  await admin.from("quizzes").delete().eq("exam_id", parsed.data.exam_id).eq("subject", parsed.data.subject);

  const { data: groups } = await admin
    .from("groups")
    .select("id")
    .eq("exam_id", parsed.data.exam_id)
    .eq("subject", parsed.data.subject);
  const groupIds = (groups ?? []).map((row: any) => String(row.id)).filter(Boolean);
  await deleteByIn(admin, "group_members", "group_id", groupIds);
  await deleteByIn(admin, "group_messages", "group_id", groupIds);
  await admin.from("groups").delete().eq("exam_id", parsed.data.exam_id).eq("subject", parsed.data.subject);

  revalidatePath(`/admin/exams/${parsed.data.exam_id}`);
  revalidatePath("/admin/exams");
  return { ok: true };
}

export async function deleteExamAction(_: unknown, formData: FormData) {
  const parsed = DeleteExamSchema.safeParse({
    exam_id: formData.get("exam_id"),
    exam_slug: formData.get("exam_slug"),
    confirm_slug: formData.get("confirm_slug")
  });
  if (!parsed.success) return { ok: false, message: "Invalid exam delete request." };

  try {
    await assertAdmin();
  } catch {
    return { ok: false, message: "Forbidden." };
  }

  if (toSlug(parsed.data.confirm_slug) !== toSlug(parsed.data.exam_slug)) {
    return { ok: false, message: "Confirmation slug mismatch. Type the exact exam slug to delete." };
  }

  let admin;
  try {
    admin = createBackendAdminClient();
  } catch {
    return {
      ok: false,
      message: "Backend datastore credentials are missing. Configure the datastore service-account credentials and redeploy."
    };
  }

  await admin.from("syllabi").delete().eq("exam_id", parsed.data.exam_id);
  await admin.from("user_exam_subjects").delete().eq("exam_id", parsed.data.exam_id);

  const { data: plans } = await admin.from("user_plans").select("id").eq("exam_id", parsed.data.exam_id);
  const planIds = (plans ?? []).map((row: any) => String(row.id)).filter(Boolean);
  await deleteByIn(admin, "plan_items", "plan_id", planIds);
  await admin.from("user_plans").delete().eq("exam_id", parsed.data.exam_id);

  const { data: quizzes } = await admin.from("quizzes").select("id").eq("exam_id", parsed.data.exam_id);
  const quizIds = (quizzes ?? []).map((row: any) => String(row.id)).filter(Boolean);
  await deleteByIn(admin, "quiz_questions", "quiz_id", quizIds);
  await deleteByIn(admin, "user_quiz_results", "quiz_id", quizIds);
  await admin.from("quizzes").delete().eq("exam_id", parsed.data.exam_id);

  const { data: groups } = await admin.from("groups").select("id").eq("exam_id", parsed.data.exam_id);
  const groupIds = (groups ?? []).map((row: any) => String(row.id)).filter(Boolean);
  await deleteByIn(admin, "group_members", "group_id", groupIds);
  await deleteByIn(admin, "group_messages", "group_id", groupIds);
  await admin.from("groups").delete().eq("exam_id", parsed.data.exam_id);

  const removeExam = await admin.from("exams").delete().eq("id", parsed.data.exam_id);
  if (removeExam.error) return { ok: false, message: removeExam.error.message };

  revalidatePath("/admin/exams");
  redirect("/admin/exams");
}

