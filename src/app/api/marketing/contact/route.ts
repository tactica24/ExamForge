import { NextResponse } from "next/server";
import { z } from "zod";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";
import { buildContactRequestMessage } from "@/lib/contact/requests";
import { buildRateLimitKeyFromRequest, hasTrustedOrigin } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  topic?: string;
  source?: string;
  message?: string;
};

const ContactSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  organization: z.string().trim().max(140).optional(),
  topic: z.string().trim().max(120).optional(),
  source: z.enum(["homepage", "contact", "enterprise"]).optional(),
  message: z.string().trim().min(10).max(2000)
});

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request.headers)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }

  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:marketing:contact", request),
    windowMs: 60 * 60 * 1000,
    max: 20
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many contact submissions. Please retry later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const payload = (await request.json()) as ContactPayload;
    const parsed = ContactSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid payload." }, { status: 400 });
    }

    const db = createFirebaseAdminClient();
    const { error } = await db.from("contact_requests").insert({
      name: parsed.data.name || null,
      email: parsed.data.email,
      topic: parsed.data.topic || null,
      message: buildContactRequestMessage({
        message: parsed.data.message,
        phone: parsed.data.phone,
        organization: parsed.data.organization
      }),
      source: parsed.data.source || "homepage",
      status: "new"
    });
    if (error) {
      return NextResponse.json({ ok: false, message: "Unable to submit request right now." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to submit request right now." }, { status: 500 });
  }
}
