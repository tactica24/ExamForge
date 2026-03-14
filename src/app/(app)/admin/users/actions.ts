"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createBackendAdminClient } from "@/lib/backend/admin";
import { computeRollingProUntil, PRO_PLAN_DAYS } from "@/lib/billing/access";

const UpdateRoleSchema = z.object({
  user_id: z.string().min(3),
  role: z.enum(["admin", "user"])
});

const UpdateRoleByEmailSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "user"])
});

const SupportSubscriptionSchema = z.object({
  email: z.string().email(),
  tier: z.enum(["free", "pro"]),
  pro_days: z.coerce.number().int().min(0).max(3650)
});

export async function setUserRoleAction(_: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Admin access required." };

  const parsed = UpdateRoleSchema.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role")
  });
  if (!parsed.success) return { ok: false, message: "Invalid role update payload." };

  if (parsed.data.user_id === user.id && parsed.data.role !== "admin") {
    return { ok: false, message: "You cannot remove your own admin role here." };
  }

  const admin = createBackendAdminClient();
  const { error } = await admin.from("profiles").upsert(
    {
      user_id: parsed.data.user_id,
      role: parsed.data.role
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, message: error.message };

  redirect("/admin/users");
}

export async function setUserRoleByEmailAction(_: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Admin access required." };

  const parsed = UpdateRoleByEmailSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role")
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid email and role." };

  const admin = createBackendAdminClient();
  const { data: profile } = await admin.from("profiles").select("user_id").eq("email", parsed.data.email).maybeSingle();
  const userId = String((profile as any)?.user_id ?? "").trim();
  if (!userId) {
    return { ok: false, message: "No account found for that email." };
  }

  const { error } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      email: parsed.data.email,
      role: parsed.data.role
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, message: error.message };

  redirect("/admin/users");
}

export async function updateUserSubscriptionAction(_: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Admin access required." };

  const parsed = SupportSubscriptionSchema.safeParse({
    email: formData.get("email"),
    tier: formData.get("tier"),
    pro_days: formData.get("pro_days")
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid email, tier, and duration." };

  const admin = createBackendAdminClient();
  const { data: profileByEmail } = await admin
    .from("profiles")
    .select("user_id,email,pro_until")
    .eq("email", parsed.data.email)
    .maybeSingle();

  const targetUid = String((profileByEmail as any)?.user_id ?? "").trim();
  const targetEmail = String((profileByEmail as any)?.email ?? parsed.data.email).trim();
  if (!targetUid) {
    return { ok: false, message: "No account found for that email." };
  }

  const tier = parsed.data.tier;
  const requestedDays = Math.max(1, parsed.data.pro_days || PRO_PLAN_DAYS);
  const proUntil =
    tier === "pro"
      ? computeRollingProUntil({
          currentPeriodEnd: (profileByEmail as any)?.pro_until ?? null,
          durationDays: requestedDays
        })
      : null;

  const { data, error } = await admin
    .from("profiles")
    .update({
      subscription_tier: tier,
      pro_until: proUntil
    })
    .eq("user_id", targetUid);

  if (error) return { ok: false, message: error.message };

  if (!data?.length) {
    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        user_id: targetUid,
        email: targetEmail,
        subscription_tier: tier,
        pro_until: proUntil
      },
      { onConflict: "user_id" }
    );
    if (upsertError) return { ok: false, message: upsertError.message };
  }

  const subscriptionRecord = {
    user_id: targetUid,
    provider: "support",
    tier,
    status: tier === "pro" ? "active" : "inactive",
    current_period_end: proUntil
  };
  const { error: subscriptionError } = await admin.from("subscriptions").upsert(subscriptionRecord, {
    onConflict: "user_id,provider"
  });
  if (subscriptionError) return { ok: false, message: subscriptionError.message };

  redirect("/admin/users");
}
