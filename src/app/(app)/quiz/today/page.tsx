import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { listPlanItemsForDate } from "@/lib/app/user-study-data";

export default async function QuizTodayPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/dashboard");

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [item] = await listPlanItemsForDate({
    firebase,
    planId: plan.id,
    scheduledFor: todayStr
  });

  if (!item) redirect("/plan");
  redirect(`/plan/${item.id}`);
}
