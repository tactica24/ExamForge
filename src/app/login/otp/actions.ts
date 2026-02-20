"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { buildRateLimitKeyFromHeaders, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

const PhoneSchema = z.object({
  phone: z.string().min(8).max(30)
});

export async function sendOtpAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromHeaders("action:otp:send", headerStore),
    windowMs: 15 * 60 * 1000,
    max: 6
  });
  if (!rate.ok) return { ok: false, message: "Too many OTP requests. Try again later." };

  const parsed = PhoneSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) return { ok: false, message: "Enter a valid phone number." };

  const firebase = await createFirebaseServerClient();
  const { error } = await firebase.auth.signInWithOtp({ phone: parsed.data.phone });
  if (error) return { ok: false, message: error.message };

  redirect(`/login/verify?phone=${encodeURIComponent(parsed.data.phone)}`);
}
