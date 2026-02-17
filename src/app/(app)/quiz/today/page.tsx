import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { getOrCreateDailyQuiz } from "@/lib/quizzes/generate";

export default async function QuizTodayPage() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const { data: profile } = await firebase
    .from("profiles")
    .select("preferred_explanation_language")
    .eq("user_id", user.id)
    .maybeSingle();

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

  const { data: exam } = await firebase.from("exams").select("name").eq("id", plan.exam_id).maybeSingle();
  const examName = exam?.name ?? "Exam";

  const quizId = await getOrCreateDailyQuiz({
    userId: user.id,
    examId: plan.exam_id,
    examName,
    subject: plan.subject,
    topicPath: item.topic_path,
    preferredLanguage: profile?.preferred_explanation_language ?? "en"
  });

  redirect(`/quiz/${quizId}`);
}
