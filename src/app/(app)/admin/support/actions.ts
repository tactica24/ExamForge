"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createBackendAdminClient } from "@/lib/backend/admin";

const IssueActionSchema = z.object({
  request_id: z.string().min(2),
  resolution_notes: z.string().trim().max(1000).optional()
});

export async function claimSupportIssueAction(_: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Admin access required." };

  const parsed = IssueActionSchema.safeParse({
    request_id: formData.get("request_id")
  });
  if (!parsed.success) return { ok: false, message: "Invalid issue payload." };

  const admin = createBackendAdminClient();
  const { error } = await admin
    .from("contact_requests")
    .update({
      status: "in_progress",
      assigned_admin_id: user.id,
      assigned_admin_email: user.email ?? null,
      assigned_at: new Date().toISOString()
    })
    .eq("id", parsed.data.request_id);

  if (error) return { ok: false, message: error.message };
  redirect("/admin/support");
}

export async function resolveSupportIssueAction(_: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Admin access required." };

  const parsed = IssueActionSchema.safeParse({
    request_id: formData.get("request_id"),
    resolution_notes: (formData.get("resolution_notes") as string | null)?.trim() || undefined
  });
  if (!parsed.success) return { ok: false, message: "Invalid resolution payload." };

  const admin = createBackendAdminClient();
  const { error } = await admin
    .from("contact_requests")
    .update({
      status: "resolved",
      assigned_admin_id: user.id,
      assigned_admin_email: user.email ?? null,
      handled_at: new Date().toISOString(),
      resolution_notes: parsed.data.resolution_notes ?? null
    })
    .eq("id", parsed.data.request_id);

  if (error) return { ok: false, message: error.message };
  redirect("/admin/support");
}

export async function reopenSupportIssueAction(_: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Admin access required." };

  const parsed = IssueActionSchema.safeParse({
    request_id: formData.get("request_id")
  });
  if (!parsed.success) return { ok: false, message: "Invalid issue payload." };

  const admin = createBackendAdminClient();
  const { error } = await admin
    .from("contact_requests")
    .update({
      status: "new",
      assigned_admin_id: null,
      assigned_admin_email: null,
      assigned_at: null,
      handled_at: null,
      resolution_notes: null
    })
    .eq("id", parsed.data.request_id);

  if (error) return { ok: false, message: error.message };
  redirect("/admin/support");
}
