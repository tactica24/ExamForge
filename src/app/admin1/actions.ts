"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { setAdminOverrideCookie } from "@/lib/auth/admin-override";
import { isUserAdmin } from "@/lib/auth/admin";
import { createBackendServerClient } from "@/lib/backend/server";
import { buildRateLimitKeyFromHeaders, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function adminLoginAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromHeaders("action:admin-login", headerStore),
    windowMs: 15 * 60 * 1000,
    max: 10
  });
  if (!rate.ok) {
    return { ok: false, message: "Too many admin login attempts. Try again in a few minutes." };
  }

  const parsed = AdminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid admin email and password." };
  }

  const backend = await createBackendServerClient();
  const result = await backend.auth.signInWithPassword(parsed.data);
  if (result.error) {
    const message = result.error.message.toLowerCase();
    if (message.includes("confirm") || message.includes("verify")) {
      redirect(`/login?verify=1&email=${encodeURIComponent(parsed.data.email)}`);
    }
    return { ok: false, message: result.error.message };
  }

  const user = result.data.user;
  const isAdmin = await isUserAdmin(backend, user);
  if (!user || !isAdmin) {
    await backend.auth.signOut();
    return {
      ok: false,
      message: "This account does not currently have admin access."
    };
  }

  const cookieStore = await cookies();
  setAdminOverrideCookie(cookieStore, {
    email: user.email,
    subject: user.id
  });

  redirect("/admin");
}
