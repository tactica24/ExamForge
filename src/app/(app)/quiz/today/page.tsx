import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createBackendServerClient } from "@/lib/backend/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";

export default async function QuizTodayPage() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: item } = await backend
    .from("plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .eq("scheduled_for", todayStr)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!item) redirect("/plan");
  redirect(`/plan/${item.id}`);
}

