import "server-only";

import { formatISO } from "date-fns";
import type { AppDataClient } from "@/lib/backend/data-client";
import { XP, computeLevel } from "@/lib/gamification/constants";
import { computeNextStreak } from "@/lib/gamification/streak";
type GamificationBackend = AppDataClient;

function asSlugArray(badges: any): string[] {
  if (!Array.isArray(badges)) return [];
  return badges.map(String);
}

export async function updateGamificationAfterQuiz(args: {
  backend: GamificationBackend;
  userId: string;
  score: number;
  total: number;
  quizId: string;
  topicPath: string;
}) {
  const today = formatISO(new Date(), { representation: "date" });

  try {
    const { data: existing, error: existingErr } = await args.backend
      .from("user_gamification")
      .select("*")
      .eq("user_id", args.userId)
      .maybeSingle();
    if (existingErr) throw existingErr;

    const current = existing ?? {
      user_id: args.userId,
      streak_count: 0,
      current_streak_date: null,
      total_xp: 0,
      level: 1,
      badges: []
    };

    const nextStreak = computeNextStreak({
      previousStreakCount: current.streak_count ?? 0,
      previousStreakDate: current.current_streak_date,
      today
    });

    const percent = args.total ? args.score / args.total : 0;
    let gained = XP.perQuiz + (percent >= 0.8 ? XP.goodScoreBonus : 0);
    if (nextStreak.isNewDay && XP.streakMilestones[nextStreak.streakCount]) {
      gained += XP.streakMilestones[nextStreak.streakCount]!;
    }

    const totalXp = (current.total_xp ?? 0) + gained;
    const level = computeLevel(totalXp);

    await args.backend.from("user_xp_events").insert({
      user_id: args.userId,
      xp: gained,
      reason: "quiz_completed",
      meta: {
        quiz_id: args.quizId,
        topic_path: args.topicPath,
        score: args.score,
        total: args.total,
        percent
      }
    });

    const { data: updated, error: upErr } = await args.backend
      .from("user_gamification")
      .upsert(
        {
          user_id: args.userId,
          streak_count: nextStreak.streakCount,
          current_streak_date: nextStreak.streakDate,
          total_xp: totalXp,
          level,
          badges: current.badges ?? []
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();
    if (upErr) throw upErr;

    const unlocked = await maybeUnlockBadges({
      backend: args.backend,
      userId: args.userId,
      streakCount: updated.streak_count,
      totalXp: updated.total_xp
    });

    return {
      ok: true as const,
      gainedXp: gained,
      totalXp: updated.total_xp,
      level: updated.level,
      streakCount: updated.streak_count,
      unlockedBadges: unlocked
    };
  } catch (e: any) {
    // Graceful fallback if tables/migrations aren't applied yet.
    return { ok: false as const, message: e?.message ?? "gamification_failed" };
  }
}

async function maybeUnlockBadges(args: {
  backend: GamificationBackend;
  userId: string;
  streakCount: number;
  totalXp: number;
}) {
  const { data: ug } = await args.backend
    .from("user_gamification")
    .select("badges")
    .eq("user_id", args.userId)
    .maybeSingle();

  const current = asSlugArray(ug?.badges);

  const { data: allBadges } = await args.backend.from("badges").select("slug,criteria,name");
  const candidates = allBadges ?? [];

  const { count: quizCount } = await args.backend
    .from("user_quiz_results")
    .select("*", { head: true, count: "exact" })
    .eq("user_id", args.userId);

  const unlocked: string[] = [];

  for (const b of candidates) {
    if (current.includes(b.slug)) continue;
    const c: any = b.criteria ?? {};
    const t = String(c.type ?? "");
    const ok =
      (t === "streak" && args.streakCount >= Number(c.days ?? 0)) ||
      (t === "xp" && args.totalXp >= Number(c.xp ?? 0)) ||
      (t === "quiz_count" && (quizCount ?? 0) >= Number(c.count ?? 0));
    if (ok) unlocked.push(b.slug);
  }

  if (!unlocked.length) return [];

  const next = [...current, ...unlocked];

  await args.backend.from("user_gamification").update({ badges: next }).eq("user_id", args.userId);

  await args.backend.from("notifications").insert(
    unlocked.map((slug) => ({
      user_id: args.userId,
      channel: "in_app" as const,
      notif_type: "alert" as const,
      message: `Badge unlocked: ${slug}`,
      scheduled_for: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      status: "sent" as const,
      provider_meta: { badge: slug }
    }))
  );

  return unlocked;
}

