"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getIdentityToolkitErrorCode, sendPasswordResetEmail } from "@/lib/firebase/identity-toolkit";
import { buildRateLimitKeyFromHeaders, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

const RecoverPasswordSchema = z.object({
  email: z.string().email()
});

const SUCCESS_MESSAGE =
  "If an account exists for that email, we've sent password reset instructions to the inbox.";

export async function recoverPasswordAction(_: unknown, formData: FormData) {
  const headerStore = await headers();
  if (!hasTrustedOrigin(headerStore)) {
    return { ok: false, message: "Blocked by origin policy." };
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromHeaders("action:recover-password", headerStore),
    windowMs: 15 * 60 * 1000,
    max: 6
  });
  if (!rate.ok) {
    return { ok: false, message: "Too many reset requests. Try again in a few minutes." };
  }

  const parsed = RecoverPasswordSchema.safeParse({
    email: formData.get("email")
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }

  try {
    await sendPasswordResetEmail(parsed.data.email);
    return { ok: true, message: SUCCESS_MESSAGE };
  } catch (error) {
    const code = getIdentityToolkitErrorCode(error);
    if (code.includes("EMAIL_NOT_FOUND")) {
      return { ok: true, message: SUCCESS_MESSAGE };
    }

    return {
      ok: false,
      message: "We couldn't send reset instructions right now. Please try again shortly."
    };
  }
}
