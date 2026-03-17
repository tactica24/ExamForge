export function sanitizeNextPath(input: string | null | undefined) {
  const next = String(input ?? "").trim();
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (next.includes("\\") || next.includes("\r") || next.includes("\n")) return null;

  try {
    const parsed = new URL(next, "http://localhost");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function isAdminPath(path: string | null | undefined) {
  const value = sanitizeNextPath(path);
  if (!value) return false;
  return value === "/admin" || value.startsWith("/admin/") || value === "/superadmin" || value.startsWith("/superadmin/");
}

function isAuthPath(path: string) {
  return path === "/login" || path.startsWith("/login/") || path === "/signup" || path === "/logout";
}

export function resolvePostAuthPath(args: {
  isAdmin: boolean;
  hasCompletedOnboarding: boolean;
  nextPath?: string | null;
}) {
  const nextPath = sanitizeNextPath(args.nextPath);

  if (args.isAdmin) {
    return isAdminPath(nextPath) ? nextPath! : "/admin";
  }

  if (!args.hasCompletedOnboarding) {
    if (nextPath === "/onboarding") {
      return "/onboarding";
    }
    return "/dashboard";
  }

  if (nextPath && nextPath !== "/onboarding" && !isAdminPath(nextPath) && !isAuthPath(nextPath)) {
    return nextPath;
  }

  return "/dashboard";
}
