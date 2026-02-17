"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { buildRateLimitKeyFromHeaders, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function loginAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = takeRateLimit({
    key: buildRateLimitKeyFromHeaders("action:login", headerStore),
    windowMs: 15 * 60 * 1000,
    max: 12
  });
  if (!rate.ok) {
    return { ok: false, message: "Too many login attempts. Try again in a few minutes." };
  }

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email and password (8+ chars)." };
  }

  const firebase = await createFirebaseServerClient();
  const { error } = await firebase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email not confirmed")) {
      return { ok: false, message: "Check your email and confirm your account before logging in." };
    }
    if (message.includes("invalid login credentials")) {
      return { ok: false, message: "Invalid email or password." };
    }
    return { ok: false, message: error.message };
  }

  const next = (formData.get("next") as string | null) ?? "/dashboard";
  redirect(next.startsWith("/") ? next : "/dashboard");
}
