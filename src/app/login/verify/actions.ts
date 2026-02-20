"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { buildRateLimitKeyFromHeaders, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

const VerifySchema = z.object({
  phone: z.string().min(8).max(30),
  token: z.string().min(4).max(12)
});

export async function verifyOtpAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromHeaders("action:otp:verify", headerStore),
    windowMs: 15 * 60 * 1000,
    max: 10
  });
  if (!rate.ok) return { ok: false, message: "Too many code attempts. Try again later." };

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
