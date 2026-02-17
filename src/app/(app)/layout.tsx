import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { createFirebaseServerClient } from "@/lib/firebase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await firebase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const isAdmin = (user.app_metadata as any)?.role === "admin";

  return (
    <AppShell
      name={profile?.display_name ?? profile?.name ?? user.email ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      isAdmin={isAdmin}
    >
      {children}
    </AppShell>
  );
}

