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

function isVercelHost(value: string | null) {
  if (!value) return false;

  try {
    return new URL(value).host.toLowerCase().endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function getAppUrl() {
  const publicUrl = toAbsoluteUrlString(process.env.NEXT_PUBLIC_APP_URL);
  const internalUrl = toAbsoluteUrlString(process.env.APP_WEB_URL);
  const configuredUrl = publicUrl ?? internalUrl;
  const vercelProductionUrl = toAbsoluteUrlString(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const vercelDeploymentUrl = toAbsoluteUrlString(process.env.VERCEL_URL);

  if (process.env.NODE_ENV === "production") {
    if (configuredUrl && !isVercelHost(configuredUrl)) return configuredUrl;
    if (vercelProductionUrl) return vercelProductionUrl;
    if (vercelDeploymentUrl) return vercelDeploymentUrl;
    return DEFAULT_APP_URL;
  }

  return configuredUrl ?? vercelDeploymentUrl ?? DEFAULT_APP_URL;
}

export function getAppOrigin() {
  return new URL(getAppUrl());
}
