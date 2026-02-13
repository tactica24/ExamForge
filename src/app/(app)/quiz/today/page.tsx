import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { getOrCreateDailyQuiz } from "@/lib/quizzes/generate";

export default async function QuizTodayPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_explanation_language")
    .eq("user_id", user.id)
    .maybeSingle();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: item } = await supabase
    .from("plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .eq("scheduled_for", todayStr)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!item) redirect("/plan");

  const { data: exam } = await supabase.from("exams").select("name").eq("id", plan.exam_id).maybeSingle();
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
