"use server";

import { z } from "zod";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { isUserAdmin } from "@/lib/auth/admin";
import { createBackendServerClient } from "@/lib/backend/server";

const ExamSchema = z.object({
  slug: z.string().min(2).max(80),
  name: z.string().min(2).max(80),
  country_code: z.string().min(2).max(20),
  description: z.string().max(500).optional(),
  subjects: z.string().min(2)
});

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

function normalizeSubjects(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = raw
    .split(/[\n,;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const item of candidates) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.slice(0, 120));
  }
  return out;
}

async function assertAdmin() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  const isAdmin = user ? await isUserAdmin(backend, user) : false;
  if (!user || !isAdmin) throw new Error("Forbidden");
}

export async function createExamAction(_: unknown, formData: FormData) {
  const parsedRaw = ExamSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    country_code: formData.get("country_code"),
    description: (formData.get("description") as string | null)?.trim() || undefined,
    subjects: formData.get("subjects")
  });

  if (!parsedRaw.success) {
    const firstIssue = parsedRaw.error.issues[0];
    return { ok: false, message: firstIssue?.message ?? "Invalid exam fields." };
  }

  const slug = toSlug(parsedRaw.data.slug);
  if (!slug || slug.length < 2) {
    return {
      ok: false,
      message: "Invalid slug. Use letters, numbers, spaces, or hyphens (e.g., waec, neco, jamb)."
    };
  }

  const subjects = normalizeSubjects(parsedRaw.data.subjects);
  if (!subjects.length) {
    return {
      ok: false,
      message: "Add at least one subject. You can separate subjects with commas or new lines."
    };
  }

  const countryCode = parsedRaw.data.country_code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

  if (!countryCode || countryCode.length < 2) {
    return { ok: false, message: "Invalid country code. Example: NG, GH, INTL." };
  }

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

  let error: { message?: string } | null = null;
  try {
    const result = await admin.from("exams").insert({
      slug,
      name: parsedRaw.data.name.trim(),
      country_code: countryCode,
      description: parsedRaw.data.description ?? null,
      subjects,
      syllabus_sources: [],
      is_active: true
    });
    error = result.error;
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to create exam." };
  }

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
      return { ok: false, message: `Exam "${slug}" already exists. Open it from the Existing exams list.` };
    }
    return { ok: false, message: msg };
  }

  return { ok: true };
}

