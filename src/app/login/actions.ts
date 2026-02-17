"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";

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

  const firebase = await createFirebaseServerClient();
  const { error } = await firebase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email not confirmed")) {
      return { ok: false, message: "Check your email and confirm your account before logging in." };
    }
    if (message.includes("invalid login credentials")) {
      return { ok: false, message: "Invalid email or password." };
    }
    return { ok: false, message: error.message };
  }

  const next = (formData.get("next") as string | null) ?? "/dashboard";
  redirect(next.startsWith("/") ? next : "/dashboard");
}