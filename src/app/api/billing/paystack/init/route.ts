import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paystackInitialize } from "@/lib/billing/paystack";
import { getServerEnv } from "@/lib/env";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const env = getServerEnv();
  const email = user.email ?? "";
  if (!email) return NextResponse.json({ ok: false, message: "Email is required for billing." }, { status: 400 });

  const callbackUrl = env.PAYSTACK_CALLBACK_URL ?? `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing/callback`;

  const init = await paystackInitialize({
    email,
    amountKobo: 500000, // ₦5,000 (adjust per tier/plan)
    callbackUrl,
    metadata: {
      user_id: user.id,
      tier: "pro"
    }
  });

  return NextResponse.json({ ok: true, url: init.authorization_url, reference: init.reference });
}
