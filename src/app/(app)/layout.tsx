import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const isAdmin = (user.app_metadata as any)?.role === "admin";

  return (
    <AppShell name={profile?.name ?? user.email ?? null} isAdmin={isAdmin}>
      {children}
    </AppShell>
  );
}

