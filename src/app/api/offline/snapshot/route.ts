import { NextResponse } from "next/server";
import { addDays, formatISO } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { listPlanItemsInWindow, listRecentQuizResults } from "@/lib/app/user-study-data";

export async function GET() {
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const plan = await getActivePlanForUser(user.id);
  if (!plan) return NextResponse.json({ ok: true, plan: null, items: [], recent: [] });

  const start = formatISO(new Date(), { representation: "date" });
  const end = formatISO(addDays(new Date(), 14), { representation: "date" });

  const [items, recent] = await Promise.all([
    listPlanItemsInWindow({
      firebase,
      planId: plan.id,
      start,
      end,
      columns: "id,scheduled_for,topic_path,title,resource_links,status,day_index,created_at"
    }),
    listRecentQuizResults({
      firebase,
      userId: user.id,
      limit: 3,
      columns: "quiz_id,score,total,created_at"
    })
  ]);

  return NextResponse.json({
    ok: true,
    plan: { id: plan.id, exam_id: plan.exam_id, subject: plan.subject, mode: plan.mode, pace: plan.pace },
    items,
    recent
  });
}
