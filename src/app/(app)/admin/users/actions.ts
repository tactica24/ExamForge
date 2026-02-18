"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-app";

const UpdateRoleSchema = z.object({
  user_id: z.string().min(3),
  role: z.enum(["admin", "user"])
});

const UpdateRoleByEmailSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "user"])
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
