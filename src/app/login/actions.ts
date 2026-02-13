"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function loginAction(_: unknown, formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email and password (8+ chars)." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: error.message };

  const next = (formData.get("next") as string | null) ?? "/dashboard";
  redirect(next.startsWith("/") ? next : "/dashboard");
}

