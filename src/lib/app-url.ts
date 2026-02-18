const DEFAULT_APP_URL = "http://localhost:3000";

function toAbsoluteUrlString(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const candidate = raw.includes("://") ? raw : `https://${raw}`;

  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getAppUrl() {
  return toAbsoluteUrlString(process.env.NEXT_PUBLIC_APP_URL) ?? DEFAULT_APP_URL;
}

export function getAppOrigin() {
  return new URL(getAppUrl());
}
