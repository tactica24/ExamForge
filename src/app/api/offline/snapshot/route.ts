import { NextResponse } from "next/server";
import { addDays, formatISO } from "date-fns";
import { createBackendServerClient } from "@/lib/backend/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";

export async function GET() {
  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const plan = await getActivePlanForUser(user.id);
  if (!plan) return NextResponse.json({ ok: true, plan: null, items: [], recent: [] });

  const start = formatISO(new Date(), { representation: "date" });
  const end = formatISO(addDays(new Date(), 14), { representation: "date" });

  const { data: items } = await backend
    .from("plan_items")
    .select("id,scheduled_for,topic_path,title,resource_links,status")
    .eq("plan_id", plan.id)
    .gte("scheduled_for", start)
    .lte("scheduled_for", end)
    .order("scheduled_for", { ascending: true });

  const { data: recent } = await backend
    .from("user_quiz_results")
    .select("quiz_id,score,total,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  return NextResponse.json({
    ok: true,
    plan: { id: plan.id, exam_id: plan.exam_id, subject: plan.subject, mode: plan.mode, pace: plan.pace },
    items: items ?? [],
    recent: recent ?? []
  });
}

