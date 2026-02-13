"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PhoneSchema = z.object({
  phone: z.string().min(8).max(30)
});

export async function sendOtpAction(_: unknown, formData: FormData) {
  const parsed = PhoneSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) return { ok: false, message: "Enter a valid phone number." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone });
  if (error) return { ok: false, message: error.message };

  redirect(`/login/verify?phone=${encodeURIComponent(parsed.data.phone)}`);
}

