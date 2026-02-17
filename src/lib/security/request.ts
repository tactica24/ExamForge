type HeaderReader = Pick<Headers, "get">;

function normalizeHost(headers: HeaderReader) {
  return (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").trim().toLowerCase();
}

function fallbackHostFromEnv() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return "";
  try {
    return new URL(appUrl).host.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeProto(headers: HeaderReader) {
  return (headers.get("x-forwarded-proto") ?? "").trim().toLowerCase();
}

function toHostFromOrigin(origin: string) {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return "";
  }
}

function toProtoFromOrigin(origin: string) {
  try {
    return new URL(origin).protocol.replace(":", "").toLowerCase();
  } catch {
    return "";
  }
}

export function hasTrustedOrigin(headers: HeaderReader) {
  const origin = (headers.get("origin") ?? "").trim();
  if (!origin) return true;

  const host = normalizeHost(headers) || fallbackHostFromEnv();
  const proto = normalizeProto(headers);
  if (!host) return false;
  const originHost = toHostFromOrigin(origin);
  if (originHost !== host) return false;
  if (!proto) return true;
  return toProtoFromOrigin(origin) === proto;
}

function extractForwardedIp(headers: HeaderReader) {
  const first = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0];
  return first ?? "";
}

function normalizePart(value: string, fallback: string) {
  const safe = value.trim().toLowerCase().replace(/[^a-z0-9:._-]/g, "");
  return safe || fallback;
}

export function buildRateLimitKeyFromHeaders(scope: string, headers: HeaderReader) {
  const ip =
    extractForwardedIp(headers) ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";
  const userAgent = headers.get("user-agent") ?? "unknown";

  const ipPart = normalizePart(ip, "unknown-ip");
  const uaPart = normalizePart(userAgent.slice(0, 80), "unknown-ua");
  return `${scope}:${ipPart}:${uaPart}`;
}

export function buildRateLimitKeyFromRequest(scope: string, request: Request) {
  return buildRateLimitKeyFromHeaders(scope, request.headers);
}
