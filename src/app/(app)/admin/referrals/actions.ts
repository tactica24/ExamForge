"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createFirebaseAdminClient } from "@/lib/firebase/admin";

const CreateCampaignCodeSchema = z.object({
  campaign_external_id: z.string().trim().min(2).max(48),
  influencer_name: z.string().trim().min(2).max(80),
  influencer_email: z.string().trim().max(120).optional(),
  influencer_phone: z.string().trim().max(40).optional(),
  code: z.string().trim().max(24).optional()
});

const ToggleCampaignCodeSchema = z.object({
  code: z.string().trim().min(6).max(24),
  next_active: z.enum(["true", "false"])
});

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

function normalizeCampaignExternalId(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 48);
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

function normalizePhone(value: unknown) {
  const phone = String(value ?? "").replace(/\s+/g, "").trim();
  return phone || null;
}

function campaignOwnerUserId(externalId: string) {
  return `campaign:${externalId.toLowerCase()}`.slice(0, 120);
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function ensureUniqueCode(admin: ReturnType<typeof createFirebaseAdminClient>, requested: string | null) {
  if (requested) {
    const { data: existing } = await admin.from("referral_codes").select("code").eq("code", requested).maybeSingle();
    if (existing?.code) {
      return { ok: false as const, message: "That referral code already exists. Choose another code." };
    }
    return { ok: true as const, code: requested };
  }

  for (let i = 0; i < 8; i += 1) {
    const code = randomCode();
    const { data: existing } = await admin.from("referral_codes").select("code").eq("code", code).maybeSingle();
    if (!existing?.code) {
      return { ok: true as const, code };
    }
  }

  return { ok: false as const, message: "Could not allocate a unique code right now. Please try again." };
}

export async function createCampaignReferralCodeAction(_: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Admin access required." };

  const parsed = CreateCampaignCodeSchema.safeParse({
    campaign_external_id: formData.get("campaign_external_id"),
    influencer_name: formData.get("influencer_name"),
    influencer_email: formData.get("influencer_email"),
    influencer_phone: formData.get("influencer_phone"),
    code: formData.get("code")
  });
  if (!parsed.success) return { ok: false, message: "Enter campaign ID, influencer name, and valid details." };

  let admin;
  try {
    admin = createFirebaseAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firebase admin credentials are missing.";
    return { ok: false, message };
  }

  const campaignExternalId = normalizeCampaignExternalId(parsed.data.campaign_external_id);
  if (campaignExternalId.length < 2) {
    return { ok: false, message: "Campaign ID can contain letters, numbers, underscore, and hyphen only." };
  }

  const manualCodeRaw = String(parsed.data.code ?? "").trim();
  const requestedCode = manualCodeRaw ? normalizeCode(manualCodeRaw) : null;
  if (manualCodeRaw && requestedCode.length < 6) {
    return { ok: false, message: "Custom code must be at least 6 characters after cleanup." };
  }

  const { data: existingCampaign } = await admin
    .from("referral_codes")
    .select("code")
    .eq("owner_kind", "campaign")
    .eq("campaign_external_id", campaignExternalId)
    .maybeSingle();

  if (existingCampaign?.code) {
    return { ok: false, message: "Campaign ID already exists. Use a unique ID per influencer/campaign." };
  }

  const codeResult = await ensureUniqueCode(admin, requestedCode);
  if (!codeResult.ok) return { ok: false, message: codeResult.message };

  const insertPayload = {
    user_id: campaignOwnerUserId(campaignExternalId),
    code: codeResult.code,
    owner_kind: "campaign",
    campaign_external_id: campaignExternalId,
    influencer_name: String(parsed.data.influencer_name).trim(),
    influencer_email: normalizeEmail(parsed.data.influencer_email),
    influencer_phone: normalizePhone(parsed.data.influencer_phone),
    is_active: true,
    created_by_admin_user_id: user.id
  };

  const { error } = await admin.from("referral_codes").insert(insertPayload);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/referrals");
  revalidatePath("/admin");
  redirect("/admin/referrals?created=1");
}

export async function toggleCampaignReferralCodeStatusAction(_: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Admin access required." };

  const parsed = ToggleCampaignCodeSchema.safeParse({
    code: formData.get("code"),
    next_active: formData.get("next_active")
  });
  if (!parsed.success) return { ok: false, message: "Invalid referral code update payload." };

  let admin;
  try {
    admin = createFirebaseAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firebase admin credentials are missing.";
    return { ok: false, message };
  }

  const { data, error } = await admin
    .from("referral_codes")
    .update({
      is_active: parsed.data.next_active === "true"
    })
    .eq("owner_kind", "campaign")
    .eq("code", normalizeCode(parsed.data.code));

  if (error) return { ok: false, message: error.message };
  if (!Array.isArray(data) || !data.length) {
    return { ok: false, message: "Campaign code not found." };
  }

  revalidatePath("/admin/referrals");
  redirect("/admin/referrals");
}
