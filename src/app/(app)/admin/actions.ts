"use server";

import { requireAdmin } from "@/app/(app)/admin/guard";
import { recomputeLeaderboards } from "@/lib/leaderboard/recompute";

export async function recomputeLeaderboardAction() {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, message: "Unauthorized." };

  const result = await recomputeLeaderboards();
  if (!result.ok) return { ok: false, message: result.message };

  return {
    ok: true,
    message: `Leaderboard refreshed at ${new Date(result.computedAt).toLocaleString()}.`
  };
}
