const PHONE_PREFIX = "Phone:";
const ORGANIZATION_PREFIX = "Organization:";

export const SUPPORT_WHATSAPP_NUMBER = "2349116314987";
export const SUPPORT_WHATSAPP_LABEL = "+234 911 631 4987";
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hello ACE NAIJA, I need help with the platform."
)}`;
export const SUPPORT_EMAIL = "info@ace-naija.com";
export const SUPPORT_EMAIL_URL = `mailto:${SUPPORT_EMAIL}`;

function cleanLine(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function buildContactRequestMessage(args: {
  message: string;
  phone?: string | null;
  organization?: string | null;
}) {
  const details: string[] = [];
  const organization = cleanLine(args.organization, 140);
  const phone = cleanLine(args.phone, 40);
  const message = String(args.message ?? "").trim();

  if (organization) details.push(`${ORGANIZATION_PREFIX} ${organization}`);
  if (phone) details.push(`${PHONE_PREFIX} ${phone}`);
  if (details.length) details.push("");
  details.push(message);

  return details.join("\n").trim();
}

export function parseContactRequestMessage(raw: unknown) {
  const lines = String(raw ?? "").split(/\r?\n/);
  let phone: string | null = null;
  let organization: string | null = null;
  const body: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed && !body.length) continue;
    if (!body.length && trimmed.startsWith(PHONE_PREFIX)) {
      phone = cleanLine(trimmed.slice(PHONE_PREFIX.length), 40) || null;
      continue;
    }
    if (!body.length && trimmed.startsWith(ORGANIZATION_PREFIX)) {
      organization = cleanLine(trimmed.slice(ORGANIZATION_PREFIX.length), 140) || null;
      continue;
    }
    body.push(line);
  }

  return {
    phone,
    organization,
    body: body.join("\n").trim()
  };
}
