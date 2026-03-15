import { redirect } from "next/navigation";
import { isUserAdmin } from "@/lib/auth/admin";
import { createBackendServerClient } from "@/lib/backend/server";

export default async function AdminEntryPage() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin1");
  }

  if (await isUserAdmin(backend, user)) {
    redirect("/admin");
  }

  redirect("/onboarding");
}
