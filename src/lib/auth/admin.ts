import "server-only";

import { executeAuroraStatement, isAuroraDataConfigured } from "@/lib/aws/rds-data";
import type { createBackendServerClient } from "@/lib/backend/server";

type BackendServerClient = Awaited<ReturnType<typeof createBackendServerClient>>;
type BackendSessionUser = Awaited<ReturnType<BackendServerClient["auth"]["getUser"]>>["data"]["user"];

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeRole(value: unknown) {
  const role = cleanText(value, 20).toLowerCase();
  return role || null;
}

function normalizeEmail(value: unknown) {
  const email = cleanText(value, 200).toLowerCase();
  return email || null;
}

async function lookupRoleByEmailCi(email: string) {
  if (!isAuroraDataConfigured()) return null;

  try {
    const result = await executeAuroraStatement({
      sql: "select role from profiles where lower(email) = lower(:email) order by created_at desc limit 1",
      parameters: [{ name: "email", value: email }]
    });
    const role = normalizeRole((result.rows[0] as Record<string, unknown> | undefined)?.role);
    return role ?? null;
  } catch {
    return null;
  }
}

export async function resolveUserRole(
  backend: BackendServerClient,
  user: BackendSessionUser | null | undefined
) {
  const sessionRole = normalizeRole((user?.app_metadata as Record<string, unknown> | undefined)?.role);
  if (sessionRole) return sessionRole;

  if (!user?.id) return null;

  const { data: profileById } = await backend.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  const roleById = normalizeRole((profileById as Record<string, unknown> | null)?.role);
  if (roleById) return roleById;

  const email = normalizeEmail(user.email);
  if (!email) return null;

  const { data: profileByEmail } = await backend.from("profiles").select("role").eq("email", email).maybeSingle();
  const roleByEmail = normalizeRole((profileByEmail as Record<string, unknown> | null)?.role);
  if (roleByEmail) return roleByEmail;

  return lookupRoleByEmailCi(email);
}

export async function isUserAdmin(
  backend: BackendServerClient,
  user: BackendSessionUser | null | undefined
) {
  return (await resolveUserRole(backend, user)) === "admin";
}
