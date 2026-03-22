const DEFAULT_APP_URL = process.env.NODE_ENV === "production" ? "https://ace-naija.com" : "http://localhost:3000";

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
  const publicUrl = toAbsoluteUrlString(process.env.NEXT_PUBLIC_APP_URL);
  const internalUrl = toAbsoluteUrlString(process.env.APP_WEB_URL);
  const configuredUrl = publicUrl ?? internalUrl;

  if (process.env.NODE_ENV === "production") {
    return configuredUrl ?? DEFAULT_APP_URL;
  }

  return configuredUrl ?? DEFAULT_APP_URL;
}

export function getAppOrigin() {
  return new URL(getAppUrl());
}
