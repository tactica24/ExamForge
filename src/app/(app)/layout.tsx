import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { OfflineWarmCache } from "@/components/offline/offline-warm-cache";
import { OfflineSync } from "@/components/offline/offline-sync";
import { createFirebaseServerClient } from "@/lib/firebase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await firebase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const isAdmin = (user.app_metadata as any)?.role === "admin";
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
      name={profile?.display_name ?? profile?.name ?? user.email ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      isAdmin={isAdmin}
    >
      <OfflineSync />
      <OfflineWarmCache lowDataMode={Boolean(profile?.low_data_mode)} />
      {children}
    </AppShell>
  );
}

