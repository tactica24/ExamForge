"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createBackendServerClient } from "@/lib/backend/server";
import { buildRateLimitKeyFromHeaders, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const ConfirmSignupSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(4).max(12)
});

function sanitizeNextPath(input: string) {
  const next = String(input ?? "").trim();
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (next.includes("\\") || next.includes("\r") || next.includes("\n")) return null;

  try {
    const parsed = new URL(next, "http://localhost");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export async function loginAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = await takeRateLimit({
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

  const backend = await createBackendServerClient();
  const result = await backend.auth.signInWithPassword(parsed.data);
  const { error } = result;
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("verify your email")) {
      return { ok: false, message: error.message };
    }
    if (message.includes("confirm")) {
      return {
        ok: false,
        message: "Check your email for the confirmation code, verify your account, then log in."
      };
    }
    if (message.includes("invalid login credentials")) {
      return { ok: false, message: "Invalid email or password." };
    }
    return { ok: false, message: error.message };
  }

  const next = sanitizeNextPath(String(formData.get("next") ?? ""));
  if (next) {
    redirect(next);
  }

  const user = result.data.user;
  const isAdmin = String((user?.app_metadata as any)?.role ?? "").toLowerCase() === "admin";
  redirect(isAdmin ? "/admin" : "/onboarding");
}

export async function confirmSignupAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromHeaders("action:signup:confirm", headerStore),
    windowMs: 15 * 60 * 1000,
    max: 10
  });
  if (!rate.ok) {
    return { ok: false, message: "Too many confirmation attempts. Try again later." };
  }

  const parsed = ConfirmSignupSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code")
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter the email and confirmation code from your inbox." };
  }

  const backend = await createBackendServerClient();
  const { error } = await backend.auth.confirmSignUp(parsed.data);
  if (error) return { ok: false, message: error.message };

  redirect("/login?verified=1");
}

export async function resendConfirmationCodeAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromHeaders("action:signup:resend", headerStore),
    windowMs: 15 * 60 * 1000,
    max: 6
  });
  if (!rate.ok) {
    return { ok: false, message: "Too many resend attempts. Try again later." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { ok: false, message: "Enter the account email first." };
  }

  const backend = await createBackendServerClient();
  const { error } = await backend.auth.resendConfirmationCode({ email });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "A new confirmation code has been sent." };
}
