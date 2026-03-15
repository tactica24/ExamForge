import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { APP_ADMIN_OVERRIDE_COOKIE } from "@/lib/backend/constants";

type CookieSetter = { set: (name: string, value: string, options: Record<string, unknown>) => unknown };
type CookieReader = { get: (name: string) => { value?: string } | undefined };
type CookieDeleter = { delete: (name: string) => unknown };

type AdminOverrideState = {
  email: string | null;
  expiresAt: string;
  subject: string;
};

function cleanText(value: unknown, maxLength = 200) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeEmail(value: unknown) {
  const email = cleanText(value, 200).toLowerCase();
  return email || null;
}

function signPayload(value: string) {
  const env = getServerEnv();
  if (!env.APP_SESSION_SECRET) {
    throw new Error("APP_SESSION_SECRET is required for admin override cookies.");
  }
  return createHmac("sha256", env.APP_SESSION_SECRET).update(value).digest("base64url");
}

function serializeState(state: AdminOverrideState) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function parseSignedState(value: string) {
  const [payload, signature] = String(value ?? "").split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const actual = Buffer.from(signature, "utf8");
  const known = Buffer.from(expected, "utf8");
  if (actual.length !== known.length || !timingSafeEqual(actual, known)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminOverrideState;
  } catch {
    return null;
  }
}

function cookieOptions(maxAgeSeconds: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
    priority: "high" as const
  };
}

export function setAdminOverrideCookie(
  store: CookieSetter,
  args: {
    email: string | null | undefined;
    subject: string;
  }
) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  const state: AdminOverrideState = {
    email: normalizeEmail(args.email),
    expiresAt,
    subject: cleanText(args.subject, 120)
  };

  store.set(
    APP_ADMIN_OVERRIDE_COOKIE,
    serializeState(state),
    cookieOptions(Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)))
  );
}

export function clearAdminOverrideCookie(store: CookieDeleter) {
  store.delete(APP_ADMIN_OVERRIDE_COOKIE);
}

export function hasAdminOverrideCookie(
  store: CookieReader,
  args: {
    email?: string | null;
    subject?: string | null;
  }
) {
  const value = cleanText(store.get(APP_ADMIN_OVERRIDE_COOKIE)?.value, 2000);
  if (!value) return false;

  const parsed = parseSignedState(value);
  if (!parsed) return false;

  const expiresAtMs = new Date(parsed.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;

  const emailMatches =
    parsed.email && args.email ? normalizeEmail(parsed.email) === normalizeEmail(args.email) : Boolean(parsed.email);
  const subjectMatches =
    parsed.subject && args.subject ? cleanText(parsed.subject, 120) === cleanText(args.subject, 120) : false;

  return Boolean(emailMatches || subjectMatches);
}
