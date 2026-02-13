import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { getOrCreateDailyQuiz } from "@/lib/quizzes/generate";

export default async function QuizTodayPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await getActivePlanForUser(user.id);
  if (!plan) redirect("/onboarding");

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
    examId: plan.exam_id,
    examName,
    subject: plan.subject,
    topicPath: item.topic_path
  });

  redirect(`/quiz/${quizId}`);
}

