"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";

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
    exam_interests: z.array(z.string().trim().min(2)).min(2).max(3)
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
  const examInterests = Array.from(
    new Set(formData.getAll("exam_interests").map((value) => String(value).trim()).filter(Boolean))
  );

  const parsed = SignupSchema.safeParse({
    surname: formData.get("surname"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
    country: formData.get("country"),
    state: (formData.get("state") as string | null) || undefined,
    exam_interests: examInterests
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check your details and try again.";
    return { ok: false, message };
  }

  const fullName = `${parsed.data.name} ${parsed.data.surname}`.trim();
  const location = parsed.data.country === "Nigeria" ? `${parsed.data.state}, Nigeria` : parsed.data.country;

  const firebase = await createFirebaseServerClient();
  const { data, error } = await firebase.auth.signUp({
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
    await firebase.from("profiles").upsert(
      {
        user_id: data.user.id,
        email: parsed.data.email,
        name: fullName,
        location,
        timezone: "Africa/Lagos",
        learning_style: "visual",
        level: "beginner",
        subscription_tier: "free",
        exam_interest_slugs: parsed.data.exam_interests,
        country: parsed.data.country,
        state: parsed.data.country === "Nigeria" ? parsed.data.state ?? null : null
      },
      { onConflict: "user_id" }
    );
  }

  if (!data.session) {
    redirect("/login?verify=1");
  }

  redirect("/onboarding");
}
