"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SignupSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  location: z.string().min(2).max(80).optional()
});

export async function signupAction(_: unknown, formData: FormData) {
  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    location: formData.get("location") || undefined
  });
  if (!parsed.success) {
    return { ok: false, message: "Check your details. Password must be 8+ characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name,
        location: parsed.data.location ?? null
      }
    }
  });
  if (error) return { ok: false, message: error.message };

  redirect("/onboarding");
}
