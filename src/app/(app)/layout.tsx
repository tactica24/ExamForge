import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { OfflineWarmCache } from "@/components/offline/offline-warm-cache";
import { OfflineSync } from "@/components/offline/offline-sync";
import { resolveUserRole } from "@/lib/auth/admin";
import { createBackendServerClient } from "@/lib/backend/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileById } = await backend.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const profile =
    profileById ??
    (user.email ? (await backend.from("profiles").select("*").eq("email", user.email).maybeSingle()).data : null);
  const isAdmin = (await resolveUserRole(backend, user)) === "admin";
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/superadmin");

  if (isAdmin && pathname && !isAdminRoute) {
    redirect("/admin");
  }
  if (!isAdmin && isAdminRoute) {
    redirect("/dashboard");
  }

  return (
    <AppShell
      name={(profile as any)?.display_name ?? (profile as any)?.name ?? user.email ?? null}
      avatarUrl={(profile as any)?.avatar_url ?? null}
      isAdmin={isAdmin}
    >
      <OfflineSync />
      <OfflineWarmCache lowDataMode={Boolean((profile as any)?.low_data_mode)} />
      {children}
    </AppShell>
  );
}

