"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createBackendServerClient } from "@/lib/backend/server";
import { buildRateLimitKeyFromHeaders, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72)
  .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
  .regex(/[a-z]/, "Password must include at least one lowercase letter.")
  .regex(/\d/, "Password must include at least one number.");

const SignupSchema = z
  .object({
    surname: z.string().trim().min(2).max(60),
    name: z.string().trim().min(2).max(60),
    email: z.string().email(),
    password: PasswordSchema,
    confirm_password: z.string().min(1),
    country: z.string().trim().min(2).max(80),
    state: z.string().trim().max(80).optional(),
    exam_interests: z
      .array(z.string().trim().min(2))
      .min(1, "Select at least one exam.")
      .max(3, "Select up to 3 exams.")
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm_password"],
        message: "Passwords do not match."
      });
    }

    if (data.country === "Nigeria" && !data.state) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state"],
        message: "State is required when country is Nigeria."
      });
    }
  });

export async function signupAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromHeaders("action:signup", headerStore),
    windowMs: 60 * 60 * 1000,
    max: 8
  });
  if (!rate.ok) {
    return { ok: false, message: "Too many signup attempts. Please retry later." };
  }

  const examInterests = Array.from(
    new Set(formData.getAll("exam_interests").map((value) => String(value).trim()).filter(Boolean))
  );

  const parsed = SignupSchema.safeParse({
    surname: String(formData.get("surname") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm_password: String(formData.get("confirm_password") ?? ""),
    country: String(formData.get("country") ?? ""),
    state: (formData.get("state") as string | null) || undefined,
    exam_interests: examInterests
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check your details and try again.";
    return { ok: false, message };
  }

  const fullName = `${parsed.data.name} ${parsed.data.surname}`.trim();
  const location = parsed.data.country === "Nigeria" ? `${parsed.data.state}, Nigeria` : parsed.data.country;

  const backend = await createBackendServerClient();
  const { data, error } = await backend.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: fullName,
        first_name: parsed.data.name,
        surname: parsed.data.surname,
        country: parsed.data.country,
        state: parsed.data.country === "Nigeria" ? parsed.data.state ?? null : null,
        location,
        exam_interests: parsed.data.exam_interests
      }
    }
  });

  if (error) return { ok: false, message: error.message };

  if (data.user?.id) {
    await backend.from("profiles").upsert(
      {
        user_id: data.user.id,
        email: parsed.data.email,
        name: fullName,
        location,
        timezone: "Africa/Lagos",
        learning_style: "visual",
        level: "beginner",
        subscription_tier: "free",
        role: "user",
        exam_interest_slugs: parsed.data.exam_interests,
        country: parsed.data.country,
        state: parsed.data.country === "Nigeria" ? parsed.data.state ?? null : null
      },
      { onConflict: "user_id" }
    );
  }

  redirect(`/login?verify=1&email=${encodeURIComponent(parsed.data.email)}`);
}
