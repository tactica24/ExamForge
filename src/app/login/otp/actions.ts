"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";

const PhoneSchema = z.object({
  phone: z.string().min(8).max(30)
});

export async function sendOtpAction(_: unknown, formData: FormData) {
  const parsed = PhoneSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) return { ok: false, message: "Enter a valid phone number." };

  const firebase = await createFirebaseServerClient();
  const { error } = await firebase.auth.signInWithOtp({ phone: parsed.data.phone });
  if (error) return { ok: false, message: error.message };

  redirect(`/login/verify?phone=${encodeURIComponent(parsed.data.phone)}`);
}
