import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";

export default async function QuizTodayPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: item } = await firebase
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
