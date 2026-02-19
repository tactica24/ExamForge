"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin-app";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { parseSyllabusDocument } from "@/lib/syllabi/document";
import { regenerateSyllabusWithAiDetailed } from "@/lib/syllabi/get";

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

const UploadDocumentSchema = z.object({
  exam_id: z.string().uuid(),
  exam_slug: z.string().min(2).max(50),
  subject: z.string().trim().min(2).max(80)
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

function toStorageDownloadUrl(bucketName: string, path: string, token: string) {
  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
}

function normalizeSyllabusSources(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 100);
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

  const bucket = getFirebaseAdminStorageBucket();
  let documentUrl: string | null = null;

  if (bucket) {
    try {
      const ext = extensionForSyllabus(parsedDoc.fileName, parsedDoc.mimeType);
      const storagePath = [
        "syllabi",
        toStorageSlug(parsed.data.exam_slug),
        toStorageSlug(parsed.data.subject),
        `${Date.now()}-${randomUUID()}.${ext}`
      ].join("/");
      const token = randomUUID();

      await bucket.file(storagePath).save(parsedDoc.bytes, {
        resumable: false,
        metadata: {
          contentType: parsedDoc.mimeType,
          cacheControl: "private, max-age=0, no-store",
          metadata: {
            firebaseStorageDownloadTokens: token
          }
        }
      });

      documentUrl = toStorageDownloadUrl(bucket.name, storagePath, token);
    } catch (e: any) {
      return {
        ok: false,
        message: `Syllabus file upload failed: ${e?.message ?? "storage_error"}`
      };
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
        document_storage: documentUrl ? "firebase_storage" : "not_configured"
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
    const firebase = await createFirebaseServerClient();
    const { data: exam } = await firebase
      .from("exams")
      .select("syllabus_sources")
      .eq("id", parsed.data.exam_id)
      .maybeSingle();
    const existing = normalizeSyllabusSources(exam?.syllabus_sources);
    const next = [documentUrl, ...existing.filter((entry) => entry !== documentUrl)].slice(0, 100);
    await firebase.from("exams").update({ syllabus_sources: next }).eq("id", parsed.data.exam_id);
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
      const ai = await regenerateSyllabusWithAiDetailed({
        examId: parsed.data.exam_id,
        examSlug: parsed.data.exam_slug,
        subject
      });

      if (!ai.topics?.length) {
        const note = ai.error ? `${subject} (${String(ai.error).slice(0, 90)})` : subject;
        failed.push(note);
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
