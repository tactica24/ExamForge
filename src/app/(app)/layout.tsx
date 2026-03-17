import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { OfflineWarmCache } from "@/components/offline/offline-warm-cache";
import { OfflineSync } from "@/components/offline/offline-sync";
import { getUserAppState } from "@/lib/auth/flow";
import { resolvePostAuthPath } from "@/lib/auth/redirects";
import { createFirebaseServerClient } from "@/lib/firebase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();

  if (!user) redirect("/login");

  const { profile, isAdmin, hasCompletedOnboarding } = await getUserAppState({
    firebase,
    user
  });
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  const resolvedPath = pathname
    ? resolvePostAuthPath({
        isAdmin,
        hasCompletedOnboarding,
        nextPath: pathname
      })
    : null;

  if (pathname && resolvedPath && resolvedPath !== pathname) {
    redirect(resolvedPath);
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

