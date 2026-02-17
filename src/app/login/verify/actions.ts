"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";

const VerifySchema = z.object({
  phone: z.string().min(8).max(30),
  token: z.string().min(4).max(12)
});

export async function verifyOtpAction(_: unknown, formData: FormData) {
  const parsed = VerifySchema.safeParse({
    phone: formData.get("phone"),
    token: formData.get("token")
  });
  if (!parsed.success) return { ok: false, message: "Enter the code." };

  const firebase = await createFirebaseServerClient();
  const { error } = await firebase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms"
  });
  if (error) return { ok: false, message: error.message };

  redirect("/onboarding");
}
