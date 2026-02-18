"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-app";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";

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

  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return { ok: false, message: "Firebase admin credentials are missing." };
  }

  try {
    const target = await auth.getUser(parsed.data.user_id);
    const currentClaims = target.customClaims ?? {};
    await auth.setCustomUserClaims(target.uid, {
      ...currentClaims,
      role: parsed.data.role
    });
    await auth.revokeRefreshTokens(target.uid);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user role.";
    return { ok: false, message };
  }

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

  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return { ok: false, message: "Firebase admin credentials are missing." };
  }

  try {
    const target = await auth.getUserByEmail(parsed.data.email);
    const currentClaims = target.customClaims ?? {};
    await auth.setCustomUserClaims(target.uid, {
      ...currentClaims,
      role: parsed.data.role
    });
    await auth.revokeRefreshTokens(target.uid);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user role.";
    return { ok: false, message };
  }

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

  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return { ok: false, message: "Firebase admin credentials are missing." };
  }

  let targetUid: string;
  let targetEmail: string;
  try {
    const target = await auth.getUserByEmail(parsed.data.email);
    targetUid = target.uid;
    targetEmail = target.email ?? parsed.data.email;
  } catch {
    return { ok: false, message: "No account found for that email." };
  }

  const tier = parsed.data.tier;
  const proUntil =
    tier === "pro"
      ? new Date(Date.now() + Math.max(1, parsed.data.pro_days || 30) * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const admin = createFirebaseAdminClient();

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

  redirect("/admin/users");
}
