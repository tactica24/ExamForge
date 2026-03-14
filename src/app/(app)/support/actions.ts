"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { createBackendServerClient } from "@/lib/backend/server";

const SupportRequestSchema = z.object({
  topic: z.string().trim().min(2).max(120),
  message: z.string().trim().min(10).max(2000)
});

export async function createSupportRequestAction(_: unknown, formData: FormData) {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();

  if (!user) return { ok: false, message: "Not authenticated." };

  const parsed = SupportRequestSchema.safeParse({
    topic: formData.get("topic"),
    message: formData.get("message")
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a topic and a clear message." };
  }

  const { data: profile } = await backend
    .from("profiles")
    .select("name,display_name,email")
    .eq("user_id", user.id)
    .maybeSingle();

  const admin = createBackendAdminClient();
  const { error } = await admin.from("contact_requests").insert({
    user_id: user.id,
    name: profile?.display_name ?? profile?.name ?? user.email ?? "User",
    email: profile?.email ?? user.email ?? null,
    topic: parsed.data.topic,
    message: parsed.data.message,
    source: "in_app",
    status: "new",
    assigned_admin_id: null,
    assigned_admin_email: null,
    assigned_at: null,
    handled_at: null,
    resolution_notes: null
  });

  if (error) return { ok: false, message: error.message };
  redirect("/support?created=1");
}

